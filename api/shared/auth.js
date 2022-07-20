const azure = require('azure-storage');
const crypto = require("crypto")
const bcrypt = require("bcryptjs")
const base64url = require("base64url")
const SimpleWebAuthnServer = require('@simplewebauthn/server');
const table = require('../shared/table.js');
const util = require('../shared/util.js');
const config = require('../config.js');


const entGen = azure.TableUtilities.entityGenerator;

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


const clientIdExpires = new Date(2040, 12, 31) // Persistent for a long time
const deleteCookieExpires = new Date(1970, 1, 1) // past date to delete cookie



exports.verifyApiKey = context => {
    const req = context.req
    const apiKey = req.headers['x-api-key']
    if (apiKey !== config.commonApiKey) {
        throw new Error(util.invalidRequestError)
    }
}


exports.check = async (context, body) => {
    // Verify authentication
    await getUserId(context)
}


exports.loginDeviceSet = async (context, body) => {
    // Ensure user is logged in
    await getUserId(context)

    try {
        const { channelId, username, authData } = body
        await table.createTableIfNotExists(authenticatorTableName)
        await clearAuthenticatorChannels()

        const userId = toUserId(username)

        // Creating a new client id for the other device 
        const clientId = makeRandomId()
        const sessionId = await createSession(clientId, userId)


        // if (!authData) {
        //     const entity = toAuthenticatorAuthTableEntity(id, '')
        //     await table.deleteEntity(authenticatorTableName, entity)
        //     return
        // }
        const entity = toAuthenticatorAuthTableEntity(channelId, authData, clientId, sessionId)
        await table.insertEntity(authenticatorTableName, entity)
        return {}
    } catch (error) {
        throw util.toError(util.invalidRequestError, error)
    }
}

exports.loginDevice = async (context, body) => {
    try {
        const { channelId } = body

        try {
            const entity = await table.retrieveEntity(authenticatorTableName, authenticatorPartitionKey, channelId)
            if (entity.authData) {
                const cookies = createCookies(entity.clientId, entity.sessionId)
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
        await table.createTableIfNotExists(usersTableName)

        let { username } = data
        if (!username) {
            username = makeRandomId()
        } else {
            // client has specified a proposed username, lets verify it is same as logged in user
            const proposedUserId = toUserId(username)
            const contextUserId = await getUserId(context)
            if (proposedUserId !== contextUserId) {
                throw new Error(util.authenticateError)
            }
        }

        const userId = toUserId(username)

        // Try get the user, if it is the first time for this user, we create a default user
        let user
        try {
            user = await getUser(userId)
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
        await updateUser(userId, user)

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

        const user = await getUser(userId);
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

        await updateUser(userId, user)

        const clientId = getClientId(context)
        const sessionId = await createSession(clientId, userId)
        const cookies = createCookies(clientId, sessionId)

        return { response: { verified: verified }, cookies: cookies }
    } catch (error) {
        throw util.toError(util.authenticateError, error)
    }
}


exports.getWebAuthnAuthenticationOptions = async (context, data) => {
    try {
        const { username } = data
        const userId = toUserId(username)

        const user = await getUser(userId);

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
        await updateUser(userId, user)

        return { options: options };
    } catch (error) {
        throw util.toError(util.authenticateError, error)
    }
}

exports.verifyWebAuthnAuthentication = async (context, data) => {
    try {
        const { username, authentication } = data
        const userId = toUserId(username)

        const user = await getUser(userId);

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
        const verification = SimpleWebAuthnServer.verifyAuthenticationResponse(verificationOptions);

        const { verified, authenticationInfo } = verification;

        if (!verified) {
            throw new Error('Failed to verify authentication')
        }

        // Update the authenticator's counter in the DB to the newest count in the authentication
        deviceAuthenticator.counter = authenticationInfo.newCounter;

        await updateUser(userId, user)

        const clientId = getClientId(context)
        const sessionId = await createSession(clientId, userId)
        const cookies = createCookies(clientId, sessionId)

        return { response: { verified }, cookies: cookies };
    } catch (error) {
        throw util.toError(util.authenticateError, error)
    }
}


exports.logoff = async (context, data) => {
    await getUserId(context)

    try {
        const clientId = getClientId(context)
        await clearClientSessions(clientId)

        const cookies = [
            {
                name: 'sessionId',
                value: '',
                path: '/',
                secure: true,
                httpOnly: true,
                sameSite: "Strict",
                expires: deleteCookieExpires,  // Passed date to delete cookie
            },
            {
                name: 'clientId',
                value: clientId,
                path: '/',
                expires: clientIdExpires,  // Persistent for a long time
                secure: true,
                httpOnly: true,
                sameSite: "Strict"
            }]

        return { cookies: cookies }
    } catch (error) {
        throw util.toError(util.authenticateError, error)
    }
}

const getUserId = async (context) => {
    try {
        const sessionId = getCookie('sessionId', context)
        if (!sessionId) {
            throw new Error(util.authenticateError)
        }

        const sessionTableEntity = await table.retrieveEntity(sessionsTableName, sessionsPartitionKey, sessionId)
        return sessionTableEntity.userId
    } catch (err) {
        throw util.toError(util.authenticateError, err)
    }
}
exports.getUserId = getUserId

const getClientId = (context) => {
    let clientId = getCookie('clientId', context)
    if (!clientId) {
        clientId = makeRandomId()
    }

    return clientId
}



async function getUser(userId) {
    const userTableEntity = await table.retrieveEntity(usersTableName, userPartitionKey, userId)

    const user = JSON.parse(userTableEntity.user)

    // Since user.devices contain binary buffers, they need to be decoded manually
    user.devices = user.devices.map(device => ({
        credentialID: Buffer.from(device.credentialID, 'base64'),
        credentialPublicKey: Buffer.from(device.credentialPublicKey, 'base64'),
        counter: device.counter,
        transports: device.transports
    }))

    return user
}


async function updateUser(userId, user) {
    // Since user.devices contain binary buffers, they need to be encoded manually
    user.devices = user.devices.map(device => ({
        credentialID: device.credentialID.toString('base64'),
        credentialPublicKey: device.credentialPublicKey.toString('base64'),
        counter: device.counter,
        transports: device.transports
    }))

    const wDek = ""
    const userItem = toUserTableEntity2(userId, user, wDek)
    await table.insertOrReplaceEntity(usersTableName, userItem)
}


async function createSession(clientId, userId) {

    // Create user data table if it does not already exist
    const tableName = dataBaseTableName + userId
    await table.createTableIfNotExists(tableName)
    await table.createTableIfNotExists(sessionsTableName)

    // Clear previous sessions from this client
    await clearClientSessions(clientId)

    // Create new session id and store
    const sessionId = makeRandomId()
    const sessionTableEntity = toSessionTableEntity(sessionId, userId, clientId)
    await table.insertEntity(sessionsTableName, sessionTableEntity)

    return sessionId
}

function createCookies(clientId, sessionId) {
    // Set session id and client id
    const cookies = [{
        name: 'sessionId',
        value: sessionId,
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: "Strict",
    },
    {
        name: 'clientId',
        value: clientId,
        path: '/',
        expires: clientIdExpires,  // Persistent for a long time
        secure: true,
        httpOnly: true,
        sameSite: "Strict"
    }]

    return cookies
}






// // // -----------------------------------------------------------------


async function clearClientSessions(clientId) {
    // Get all existing sessions for the client or very old sessions
    let dateVal = new Date(new Date().getTime() - (2 * util.day));
    let tableQuery = new azure.TableQuery()
        .where('PartitionKey == ?string? && (clientId == ?string? || Timestamp <= ?date?)',
            sessionsPartitionKey, clientId, dateVal);

    const items = await table.queryEntities(sessionsTableName, tableQuery, null)
    const keys = items.map(item => item.RowKey)
    if (keys.length === 0) {
        return
    }

    // Remove these entities
    const entityItems = keys.map(key => toRemoveEntityItem(key, sessionsPartitionKey))
    const batch = new azure.TableBatch()
    entityItems.forEach(entity => batch.deleteEntity(entity))
    await table.executeBatch(sessionsTableName, batch)
}

async function clearAuthenticatorChannels() {
    // Get all old channels
    let dateVal = new Date(new Date().getTime() - (5 * util.minute));
    let tableQuery = new azure.TableQuery()
        .where('PartitionKey == ?string? && Timestamp <= ?date?',
            authenticatorPartitionKey, dateVal);

    const items = await table.queryEntities(authenticatorTableName, tableQuery, null)
    const keys = items.map(item => item.RowKey)
    if (keys.length === 0) {
        return
    }

    // Remove these entities
    const entityItems = keys.map(key => toRemoveEntityItem(key, authenticatorPartitionKey))
    const batch = new azure.TableBatch()
    entityItems.forEach(entity => batch.deleteEntity(entity))
    await table.executeBatch(authenticatorTableName, batch)
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


const bcryptGenSalt = (saltRounds) => {
    return new Promise(function (resolve, reject) {
        bcrypt.genSalt(saltRounds, function (err, salt) {
            if (err) {
                reject(err)
            } else {
                resolve(salt)
            }
        })
    })
}


const bcryptHash = (password, salt) => {
    return new Promise(function (resolve, reject) {
        bcrypt.hash(password, salt, function (err, hash) {
            if (err) {
                reject(err)
            } else {
                resolve(hash)
            }
        })
    })
}

const bcryptCompare = (password, hash) => {
    return new Promise(function (resolve, reject) {
        bcrypt.compare(password, hash, function (err, isMatch) {
            if (err) {
                reject(err)
            } else {
                resolve(isMatch)
            }
        })
    })
}


function makeRandomId() {
    let ID = "";
    let characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    for (var i = 0; i < 12; i++) {
        ID += characters.charAt(Math.floor(Math.random() * 36));
    }
    return ID;
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



function toUserTableEntity2(userId, user, wDek) {
    // Since user.devices contain binary buffers, they need to be encoded manually
    user.devices = user.devices.map(device => ({
        credentialID: device.credentialID.toString('base64'),
        credentialPublicKey: device.credentialPublicKey.toString('base64'),
        counter: device.counter,
        transports: device.transports
    }))

    const userJson = JSON.stringify(user)

    return {
        RowKey: entGen.String(userId),
        PartitionKey: entGen.String(userPartitionKey),

        user: entGen.String(userJson),
        wDek: entGen.String(wDek),
    }
}


function toAuthenticatorAuthTableEntity(id, authData, clientId, sessionId) {
    return {
        RowKey: entGen.String(id),
        PartitionKey: entGen.String(authenticatorPartitionKey),

        authData: entGen.String(authData),
        clientId: entGen.String(clientId),
        sessionId: entGen.String(sessionId),
    }
}


function toSessionTableEntity(sessionId, userId, clientId) {
    return {
        RowKey: entGen.String(sessionId),
        PartitionKey: entGen.String(sessionsPartitionKey),

        userId: entGen.String(userId),
        clientId: entGen.String(clientId),
    }
}


function toRemoveEntityItem(key, partitionKey) {
    const item = {
        RowKey: entGen.String(key),
        PartitionKey: entGen.String(partitionKey),
    }

    return item
}


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
