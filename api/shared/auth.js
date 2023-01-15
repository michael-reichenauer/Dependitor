const { odata, TableTransaction } = require("@azure/data-tables");
const crypto = require("crypto")
const base64url = require("base64url")
const SimpleWebAuthnServer = require('@simplewebauthn/server');
const table = require('../shared/table.js');
const util = require('../shared/util.js');
const config = require('../config.js');

const ServiceName = 'Dependitor';
const defaultTransports = ['internal', 'usb', 'ble', 'nfc'] // possible: ['internal', 'usb', 'ble', 'nfc']
const maxUserDeviceRegistrations = 20

const dataBaseTableName = 'data'
const usersTableName = 'users'
const authenticatorTableName = 'authenticator'
const sessionsTableName = 'sessions'

const userPartitionKey = 'users'
const sessionsPartitionKey = 'sessions'
const authenticatorPartitionKey = 'authenticator'

const deleteCookieExpires = new Date(1970, 1, 1) // past date to delete cookie
const sessionDuration = 10 * util.hour
const authenticatorLoginDuration = 3 * util.minute

const cryptoAlgorithm = "aes-256-cbc";


// Call in every server api function to verify that client has expected api key,
// Which changes for every build
exports.verifyApiKey = context => {
    const req = context.req
    const apiKey = req.headers['x-api-key']
    if (apiKey !== config.commonApiKey) {
        throw new Error(util.invalidRequestError)
    }
}

// Called by client to api is upp and running and client has been logged in.
exports.check = async (context, body, userId) => {
    // Verify authentication
    if (!userId) {
        throw new Error(util.authenticateError)
    }
}

// Called by the Authenticator to post a responds to a device calling loginDevice()
exports.loginDeviceSet = async (context, body, userId) => {
    try {
        const { channelId, authData } = body
        await table.service().createTable(authenticatorTableName)
        await clearOldAuthenticatorChannels(context)

        // Creating a new client id and session for the other device 
        const sessionId = await createSession(context, userId)

        // Store data for other device to retrieve using the loginDevice() call
        //const entity = toAuthenticatorAuthTableEntity(channelId, authData, sessionId)
        const entity = {
            partitionKey: authenticatorPartitionKey,
            rowKey: channelId,
            authData: authData,
            sessionId: sessionId,
        }

        await table.client(authenticatorTableName).createEntity(entity)

        return {}
    } catch (error) {
        throw util.toError(util.invalidRequestError, error)
    }
}


// Called by devices trying to retrieve Authenticator response set by loginDeviceSet
exports.loginDevice = async (context, body) => {
    try {
        context.log('env:', process.env)
        //context.log("context@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@", context)
        context.log("Host !!!!!!!!!!", process.env.WEBSITE_HOSTNAME)
        const { channelId } = body

        context.log('Target branch:', config.targetBranch)

        try {
            const entity = await table.client(authenticatorTableName).getEntity(authenticatorPartitionKey, channelId)

            if (entity.authData) {
                const expireDate = util.currentDateAdd(authenticatorLoginDuration);
                const entityDate = Date.parse(entity.Timestamp)
                if (entityDate > expireDate) {
                    throw new Error('Expired')
                }

                const cookies = createCookies(entity.sessionId)
                return { response: entity.authData, cookies: cookies };
            }
        } catch (error) {
            // Ignore errors, just return empty response
            return { response: '', cookies: null };
        }
    } catch (error) {
        throw util.toError(util.authenticateError, error)
    }
}


// getWebAuthnRegistrationOptions is called when a user wants to register a device for authentication
exports.getWebAuthnRegistrationOptions = async (context, data) => {
    try {
        // Make sure the user table exists.
        await table.service().createTable(usersTableName)

        let { username } = data
        if (!username) {
            // The authenticator does not specify a user, i.e. a new random user name is generated
            username = makeRandomId()
        } else {
            // A caller has proposed a username, lets verify it is same as logged in user
            // Which was authenticated by the authenticator.
            const proposedUserId = toUserId(username)
            const contextUserId = await getLoginUserId(context)
            if (proposedUserId !== contextUserId) {
                // Does no match, the caller was not authenticated by an authenticator
                throw new Error(util.authenticateError)
            }
        }

        const userId = toUserId(username)

        // Try get the user, if it is the first time for this user, we create a default user
        // otherwise the device will be added to the user
        let user
        try {
            user = await retrieveUser(userId, username)
        } catch (err) {
            // No user with that name registered, user default user
            user = { id: userId, username: username, devices: [] }
        }

        const generateOptions = {
            rpName: ServiceName,
            userID: userId,
            userName: username,
            attestationType: 'none', // None to avoid privacy concent issues
            authenticatorSelection: {
                userVerification: 'preferred', // ("discouraged", "preferred", "required")
            },
            supportedAlgorithmIDs: [-7, -257],
        };

        const options = SimpleWebAuthnServer.generateRegistrationOptions(generateOptions);

        // Store the current challenge for this user for next verifyWebAuthnRegistration() call
        user.currentChallenge = options.challenge
        await insertOrReplaceUser(userId, user, username)

        return { options: options, username: username };
    } catch (error) {
        throw util.toError(util.authenticateError, error)
    }
}

// verifyWebAuthnRegistration is called to verify a device registration
exports.verifyWebAuthnRegistration = async (context, data) => {
    try {
        const { username, registration } = data
        const userId = toUserId(username)

        const user = await retrieveUser(userId, username);
        const expectedChallenge = user.currentChallenge;
        user.currentChallenge = null

        // Currently using registration origin, but can be narrowed to some wellknown origins
        const expectedOrigin = getExpectedOrigin(registration.response.clientDataJSON)

        const verifyOptions = {
            credential: registration,
            expectedChallenge: `${expectedChallenge}`,
            expectedOrigin,
            requireUserVerification: true,
        };
        const verification = await SimpleWebAuthnServer.verifyRegistrationResponse(verifyOptions);
        const { verified, registrationInfo } = verification;
        if (!verified || !registrationInfo) {
            throw new Error('Failed to verify registration')
        }

        // Verification of registration succeeded, lets update user info 
        const { credentialPublicKey, credentialID, counter } = registrationInfo;
        const existingDevice = user.devices.find(device => device.credentialID.equals(credentialID));

        if (!existingDevice) {
            // Add the returned device to the user's list of devices
            const newDevice = {
                credentialPublicKey,
                credentialID,
                counter,
                transports: registration.transports,
            };
            user.devices.push(newDevice);
        }

        // Limit number of allowed user device registrations
        user.devices = user.devices.slice(-maxUserDeviceRegistrations)

        await insertOrReplaceUser(userId, user, username)


        const sessionId = await createSession(context, userId)
        const cookies = createCookies(sessionId)

        return { response: { verified: verified }, cookies: cookies }
    } catch (error) {
        throw util.toError(util.authenticateError, error)
    }
}


exports.getWebAuthnAuthenticationOptions = async (context, data) => {
    try {
        const { username } = data
        const userId = toUserId(username)

        const user = await retrieveUser(userId, username);

        // Currently using request origin, can be narrowed to some wellknown origins
        const expectedRPID = getRPId(context)

        const generateOptions = {
            allowCredentials: user.devices.map(device => {
                let transports = device.transports
                if (!transports) {
                    transports = defaultTransports
                }
                return {
                    id: device.credentialID,
                    type: 'public-key',
                    transports: transports,
                }
            }),
            userVerification: 'required',
            rpID: expectedRPID
        };

        const options = SimpleWebAuthnServer.generateAuthenticationOptions(generateOptions);

        // Store the challenge to be verified in the next verifyWebAuthnAuthentication() call
        user.currentChallenge = options.challenge
        await insertOrReplaceUser(userId, user, username)

        return { options: options };
    } catch (error) {
        throw util.toError(util.authenticateError, error)
    }
}

exports.verifyWebAuthnAuthentication = async (context, data) => {
    try {
        const { username, authentication } = data
        const userId = toUserId(username)

        const user = await retrieveUser(userId, username);

        // Get the current challenge stored in the previous getWebAuthnAuthenticationOptions() call
        const expectedChallenge = user.currentChallenge;
        user.currentChallenge = null

        const expectedOrigin = getExpectedOrigin(authentication.response.clientDataJSON)
        const expectedRPID = getRPId(context)

        // Get the specified device authenticator
        const credentialID = base64url.toBuffer(authentication.rawId);
        let deviceAuthenticator = user.devices.find(device => device.credentialID.equals(credentialID));
        if (!deviceAuthenticator) {
            throw new Error(`could not find device authenticator matching ${authentication.id}`);
        }

        const verificationOptions = {
            credential: authentication,
            expectedChallenge: `${expectedChallenge}`,
            expectedOrigin,
            expectedRPID: expectedRPID,
            authenticator: deviceAuthenticator,
            requireUserVerification: true,
        };
        const verification = await SimpleWebAuthnServer.verifyAuthenticationResponse(verificationOptions);

        const { verified, authenticationInfo } = verification;

        if (!verified) {
            throw new Error('Failed to verify authentication')
        }

        // Update the authenticator's counter in the DB to the newest count in the authentication
        deviceAuthenticator.counter = authenticationInfo.newCounter;

        await insertOrReplaceUser(userId, user, username)

        const sessionId = await createSession(context, userId)
        const cookies = createCookies(sessionId)

        return { response: { verified }, cookies: cookies };
    } catch (error) {
        throw util.toError(util.authenticateError, error)
    }
}


exports.logoff = async (context, data, userId) => {
    try {
        await clearOldSessions(context)

        const cookies = [
            {
                name: 'sessionId',
                value: '',
                path: '/',
                secure: true,
                httpOnly: true,
                sameSite: "Strict",
                expires: deleteCookieExpires,  // Passed date to delete cookie
            }]

        return { cookies: cookies }
    } catch (error) {
        throw util.toError(util.authenticateError, error)
    }
}

const getLoginUserId = async (context) => {
    try {
        const sessionId = getCookie('sessionId', context)
        if (!sessionId) {
            throw new Error(util.authenticateError)
        }

        // const entity = await table.retrieveEntity(sessionsTableName, sessionsPartitionKey, sessionId)
        const entity = await table.client(sessionsTableName).getEntity(sessionsPartitionKey, sessionId);
        const expireDate = util.currentDateAdd(sessionDuration);
        const entityDate = Date.parse(entity.Timestamp)
        if (entityDate > expireDate) {
            throw new Error(util.authenticateError)
        }

        return entity.userId
    } catch (err) {
        throw util.toError(util.sessionError, err)
    }
}
exports.getLoginUserId = getLoginUserId


async function retrieveUser(userId, username) {
    // const userTableEntity = await table.retrieveEntity(usersTableName, userPartitionKey, userId)
    const userTableEntity = await table.client(usersTableName).getEntity(userPartitionKey, userId);

    // Simple decryption of user date based on user name, which is not stored by server in clear text
    const userJson = decrypt(userTableEntity.user, username, username)

    // The user struct is a json string
    const user = JSON.parse(userJson)

    // Since user.devices contain binary buffers, they need to be decoded manually
    user.devices = user.devices.map(device => ({
        credentialID: Buffer.from(device.credentialID, 'base64'),
        credentialPublicKey: Buffer.from(device.credentialPublicKey, 'base64'),
        counter: device.counter,
        transports: device.transports
    }))

    return user
}


async function insertOrReplaceUser(userId, user, username) {
    // Since user.devices contain binary buffers, they need to be encoded manually
    user.devices = user.devices.map(device => ({
        credentialID: device.credentialID.toString('base64'),
        credentialPublicKey: device.credentialPublicKey.toString('base64'),
        counter: device.counter,
        transports: device.transports
    }))

    // Convert the user struct to json
    const userJson = JSON.stringify(user)

    // Simple encryption of user data based on user name, which is not stored by server in clear text
    const userJsonData = encrypt(userJson, username, username)

    const entity = {
        partitionKey: userPartitionKey,
        rowKey: userId,
        user: userJsonData,
    }

    await table.client(usersTableName).upsertEntity(entity, "Replace")
}


async function createSession(context, userId) {
    // Create user data table if it does not already exist
    const dataTableName = dataBaseTableName + userId
    await table.service().createTable(dataTableName)
    await table.service().createTable(sessionsTableName)

    // Clear previous sessions from this client
    await clearOldSessions(context)

    // Create new session id and store
    const sessionId = makeRandomId()
    //const sessionTableEntity = toSessionTableEntity(sessionId, userId)
    const sessionTableEntity = {
        partitionKey: sessionsPartitionKey,
        rowKey: sessionId,
        userId: userId,
    }

    await table.client(sessionsTableName).createEntity(sessionTableEntity)

    // await table.insertEntity(sessionsTableName, sessionTableEntity)

    return sessionId
}

function createCookies(sessionId) {
    // Set session id and client id
    const cookies = [{
        name: 'sessionId',
        value: sessionId,
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: "Strict",
    }]

    return cookies
}



// // // -----------------------------------------------------------------


async function clearOldSessions(context) {
    // Get all existing sessions for the client or very old sessions
    let dateVal = new Date(new Date().getTime() - sessionDuration);
    // let tableQuery = new azure.TableQuery()
    //     .where('PartitionKey == ?string? && Timestamp <= ?date?',
    //         sessionsPartitionKey, dateVal);

    //const items = await table.queryEntities(sessionsTableName, tableQuery, null)

    const entities = table.client(sessionsTableName).listEntities({
        queryOptions: { filter: odata`PartitionKey eq ${sessionsPartitionKey} and Timestamp le ${dateVal}` }
    })

    const items = []
    for await (const entity of entities) {
        items.push(entity);
    }

    context.log("clearOldSessions: items", items);

    const keys = items.map(item => item.rowKey)
    if (keys.length === 0) {
        return
    }

    // Remove these entities
    const transaction = new TableTransaction();
    keys.forEach(key => transaction.deleteEntity(sessionsPartitionKey, key))
    await table.client(sessionsTableName).submitTransaction(transaction.actions);


    // const entityItems = keys.map(key => table.toDeleteEntity(key, sessionsPartitionKey))
    // const batch = new azure.TableBatch()
    // entityItems.forEach(entity => batch.deleteEntity(entity))
    // await table.executeBatch(sessionsTableName, batch)
}

async function clearOldAuthenticatorChannels(context) {
    // Get all old channels
    let dateVal = new Date(new Date().getTime() - (5 * util.minute));
    // let tableQuery = new azure.TableQuery()
    //     .where('PartitionKey == ?string? && Timestamp <= ?date?',
    //         authenticatorPartitionKey, dateVal);

    // const items = await table.queryEntities(authenticatorTableName, tableQuery, null)
    const entities = table.client(authenticatorTableName).listEntities({
        queryOptions: { filter: odata`PartitionKey eq ${authenticatorPartitionKey} and Timestamp le ${dateVal}` }
    })

    const items = []
    for await (const entity of entities) {
        items.push(entity);
    }

    // context.log("clearOldAuthenticatorChannels: items", items);

    const keys = items.map(item => item.rowKey)
    if (keys.length === 0) {
        return
    }

    // Remove these entities
    const transaction = new TableTransaction();
    keys.forEach(key => transaction.deleteEntity(authenticatorPartitionKey, key))
    await table.client(authenticatorTableName).submitTransaction(transaction.actions);

    // // const entityItems = keys.map(key => table.toDeleteEntity(key, authenticatorPartitionKey))
    // // const batch = new azure.TableBatch()
    // // entityItems.forEach(entity => batch.deleteEntity(entity))
    // // await table.executeBatch(authenticatorTableName, batch)
}


function getCookie(name, context) {
    const cookie = context.req.headers["cookie"]
    if (!cookie) {
        return null
    }
    // Split cookie string and get all individual name=value pairs in an array
    var cookieArr = cookie.split(";");

    // Loop through the array elements
    for (var i = 0; i < cookieArr.length; i++) {
        var cookiePair = cookieArr[i].split("=");

        // Removing whitespace at the beginning of the cookie name
        /// and compare it with the given string 
        if (name === cookiePair[0].trim()) {
            // Decode the cookie value and return
            return decodeURIComponent(cookiePair[1]);
        }
    }

    // Return null if not found
    return null;
}


function makeRandomId() {
    return randomString(12)
}


function randomString(count) {
    let randomText = "";
    const randomBytes = crypto.randomBytes(count);
    let characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvxyz0123456789";

    for (var i = 0; i < count; i++) {
        randomText += characters.charAt(randomBytes[i] % characters.length);
    }
    return randomText;
};



// function toUserTableEntity(userId, user) {
//     return {
//         RowKey: table.String(userId),
//         PartitionKey: table.String(userPartitionKey),

//         user: table.String(user),
//     }
// }


// function toAuthenticatorAuthTableEntity(id, authData, sessionId) {
//     return {
//         RowKey: table.String(id),
//         PartitionKey: table.String(authenticatorPartitionKey),

//         authData: table.String(authData),
//         sessionId: table.String(sessionId),
//     }
// }


// function toSessionTableEntity(sessionId, userId) {
//     return {
//         RowKey: table.String(sessionId),
//         PartitionKey: table.String(sessionsPartitionKey),

//         userId: table.String(userId),
//     }
// }


function sha256(message) {
    return crypto.createHash("sha256")
        .update(message)
        .digest("hex");
}

function toUserId(name) {
    return sha256(name.toLowerCase()).substr(0, 32)
}

function getRPId(context) {
    const url = new URL(context.req.headers.origin);
    const rpID = url.hostname;
    return rpID
}

function getExpectedOrigin(clientDataJSONField) {
    const clientDataJSON = base64url.decode(clientDataJSONField);
    const clientData = JSON.parse(clientDataJSON);
    const expectedOrigin = clientData.origin
    return expectedOrigin
}

function encrypt(text, key, salt) {
    // Creating dek from the key and salt and an empty iv, since that is ok in this case
    const dek = crypto.scryptSync(key, salt, 32);
    const iv = Buffer.alloc(16, 0);

    // Encrypting
    const cipher = crypto.createCipheriv(cryptoAlgorithm, dek, iv);
    let encryptedText = cipher.update(text, "utf-8", "base64");
    encryptedText += cipher.final("base64");

    return encryptedText
}

function decrypt(encryptedText, key, salt) {
    // Creating dek from the key and salt and an empty iv, since that is ok in this case
    const dek = crypto.scryptSync(key, salt, 32);
    const iv = Buffer.alloc(16, 0);

    // Decrypting
    const decipher = crypto.createDecipheriv(cryptoAlgorithm, dek, iv);
    let decryptedText = decipher.update(encryptedText, "base64", "utf-8");
    decryptedText += decipher.final("utf8");

    return decryptedText
}