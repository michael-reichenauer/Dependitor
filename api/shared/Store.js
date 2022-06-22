const azure = require('azure-storage');
const crypto = require("crypto")
const bcrypt = require("bcryptjs")
// const base64url = require("base64url")
// const SimpleWebAuthnServer = require('@simplewebauthn/server');
var table = require('../shared/table.js');




const entGen = azure.TableUtilities.entityGenerator;

const dataBaseTableName = 'data'
const usersTableName = 'users'
const sessionsTableName = 'sessions'

const userPartitionKey = 'users'
const dataPartitionKey = 'data'
const sessionsPartitionKey = 'sessions'

const standardApiKey = '0624bc00-fcf7-4f31-8f3e-3bdc3eba7ade'
const saltRounds = 10

const invalidRequestError = 'InvalidRequestError'
const authenticateError = 'AuthenticateError'
const emulatorErrorText = "ECONNREFUSED 127.0.0.1:10002"
const clientIdExpires = new Date(2040, 12, 31) // Persistent for a long time
const deleteCookieExpires = new Date(1970, 1, 1) // past date to delete cookie

exports.verifyApiKey = context => {
    const req = context.req
    const apiKey = req.headers['x-api-key']
    if (apiKey !== standardApiKey) {
        throw new Error(invalidRequestError)
    }
}


exports.createUser = async (context, data) => {
    const { user, wDek } = data
    if (!user || !user.username || !user.password || !wDek) {
        throw new Error(invalidRequestError)
    }

    try {
        const { username, password } = user

        const userId = toUserId(username)

        // Hash the password using bcrypt
        const salt = await bcryptGenSalt(saltRounds)
        const passwordHash = await bcryptHash(password, salt)

        const userItem = toUserTableEntity(userId, passwordHash, wDek)

        await table.createTableIfNotExists(usersTableName)
        await table.insertEntity(usersTableName, userItem)
    } catch (err) {
        if (err.message.includes(emulatorErrorText)) {
            throw new Error(invalidRequestError + ': ' + emulatorErrorText)
        }
        throw new Error(authenticateError)
    }
}

const loggedInUserId = 'user1'
// Human-readable title for your website
// Human-readable title for your website
const rpName = 'Dependitor';
// A unique identifier for your website
const rpID = 'localhost';
// The URL at which registrations and authentications should occur
// const origin = `https://${rpID}`;

const inMemoryUserDeviceDB = {
    user1: {
        id: loggedInUserId,
        username: `user@${rpID}`,
        devices: [],
        /**
         * A simple way of storing a user's current challenge being signed by registration or authentication.
         * It should be expired after `timeout` milliseconds (optional argument for `generate` methods,
         * defaults to 60000ms)
         */
        currentChallenge: undefined,

    }
};

exports.getWebAuthnRegistrationOptions = async (context, data) => {
    //context.log('connectUser', context, data)
    context.log('dataxx', loggedInUserId, rpName, rpID, inMemoryUserDeviceDB)
    return {}

    // try {
    //     context.log('db:', inMemoryUserDeviceDB);
    //     // (Pseudocode) Retrieve the user from the database after they've logged in
    //     const user = inMemoryUserDeviceDB[loggedInUserId];
    //     const {
    //         /**
    //          * The username can be a human-readable name, email, etc... as it is intended only for display.
    //          */
    //         username,
    //         devices,
    //     } = user;

    //     context.log('User:', user);
    //     const opts = {
    //         rpName: rpName,
    //         rpID: rpID,
    //         userID: loggedInUserId,
    //         userName: username,
    //         timeout: 60000,
    //         attestationType: 'none',
    //         /**
    //          * Passing in a user's list of already-registered authenticator IDs here prevents users from
    //          * registering the same device multiple times. The authenticator will simply throw an error in
    //          * the browser if it's asked to perform registration when one of these ID's already resides
    //          * on it.
    //          */
    //         excludeCredentials: devices.map(dev => ({
    //             id: dev.credentialID,
    //             type: 'public-key',
    //             transports: dev.transports,
    //         })),
    //         /**
    //          * The optional authenticatorSelection property allows for specifying more constraints around
    //          * the types of authenticators that users to can use for registration
    //          */
    //         authenticatorSelection: {
    //             userVerification: 'required',
    //         },
    //         /**
    //          * Support the two most common algorithms: ES256, and RS256
    //          */
    //         supportedAlgorithmIDs: [-7, -257],
    //     };

    //     const options = SimpleWebAuthnServer.generateRegistrationOptions(opts);
    //     inMemoryUserDeviceDB[loggedInUserId].currentChallenge = options.challenge;

    //     // (Pseudocode) Remember the challenge for this user
    //     context.log('options:', options);
    //     context.log('db:', inMemoryUserDeviceDB);
    //     //setUserCurrentChallenge(user, options.challenge);

    //     return options;
    // } catch (err) {
    //     if (err.message.includes(emulatorErrorText)) {
    //         throw new Error(invalidRequestError + ': ' + emulatorErrorText)
    //     }
    //     throw new Error(authenticateError)
    // }
}

exports.verifyWebAuthnRegistration = async (context, data) => {
    //context.log('connectUser', context, data)
    return {}
    // try {
    //     context.log('db:', inMemoryUserDeviceDB);
    //     context.log('data:', data);
    //     const body = data;

    //     const expectedOrigin = `http://localhost:${3000}`;

    //     const user = inMemoryUserDeviceDB[loggedInUserId];

    //     const expectedChallenge = user.currentChallenge;

    //     let verification;
    //     try {
    //         const opts = {
    //             credential: body,
    //             expectedChallenge: `${expectedChallenge}`,
    //             expectedOrigin,
    //             expectedRPID: rpID,
    //             requireUserVerification: true,
    //         };
    //         verification = await SimpleWebAuthnServer.verifyRegistrationResponse(opts);
    //     } catch (error) {
    //         context.log('Error', error)
    //         throw new Error(error)
    //     }

    //     const { verified, registrationInfo } = verification;

    //     if (verified && registrationInfo) {
    //         const { credentialPublicKey, credentialID, counter } = registrationInfo;

    //         const existingDevice = user.devices.find(device => device.credentialID === credentialID);

    //         if (!existingDevice) {
    //             /**
    //              * Add the returned device to the user's list of devices
    //              */
    //             const newDevice = {
    //                 credentialPublicKey,
    //                 credentialID,
    //                 counter,
    //                 transports: body.transports,
    //             };
    //             user.devices.push(newDevice);
    //         }
    //     }

    //     context.log('db:', inMemoryUserDeviceDB);
    //     return { verified };

    // } catch (err) {
    //     if (err.message.includes(emulatorErrorText)) {
    //         throw new Error(invalidRequestError + ': ' + emulatorErrorText)
    //     }
    //     throw new Error(authenticateError)
    // }
}


exports.getWebAuthnAuthenticationOptions = async (context, data) => {
    //context.log('connectUser', context, data)
    return {}
    // try {
    //     context.log('db:', inMemoryUserDeviceDB);
    //     // (Pseudocode) Retrieve the user from the database after they've logged in
    //     // You need to know the user by this point
    //     const user = inMemoryUserDeviceDB[loggedInUserId];

    //     const opts = {
    //         timeout: 60000,
    //         allowCredentials: user.devices.map(dev => ({
    //             id: dev.credentialID,
    //             type: 'public-key',
    //             transports: dev.transports ?? ['usb', 'ble', 'nfc', 'internal'],
    //         })),
    //         userVerification: 'required',
    //         rpID,
    //     };

    //     const options = SimpleWebAuthnServer.generateAuthenticationOptions(opts);

    //     /**
    //      * The server needs to temporarily remember this value for verification, so don't lose it until
    //      * after you verify an authenticator response.
    //      */
    //     inMemoryUserDeviceDB[loggedInUserId].currentChallenge = options.challenge;

    //     return options;
    // } catch (err) {
    //     if (err.message.includes(emulatorErrorText)) {
    //         throw new Error(invalidRequestError + ': ' + emulatorErrorText)
    //     }
    //     throw new Error(authenticateError)
    // }
}

exports.verifyWebAuthnAuthentication = async (context, data) => {
    //context.log('connectUser', context, data)
    return {}

    // try {
    //     context.log('db:', inMemoryUserDeviceDB);
    //     context.log('data:', data);
    //     const body = data;

    //     const user = inMemoryUserDeviceDB[loggedInUserId];

    //     const expectedChallenge = user.currentChallenge;

    //     let dbAuthenticator;
    //     const bodyCredIDBuffer = base64url.toBuffer(body.rawId);
    //     // "Query the DB" here for an authenticator matching `credentialID`
    //     for (const dev of user.devices) {
    //         if (dev.credentialID.equals(bodyCredIDBuffer)) {
    //             dbAuthenticator = dev;
    //             break;
    //         }
    //     }

    //     if (!dbAuthenticator) {
    //         throw new Error(`could not find authenticator matching ${body.id}`);
    //     }
    //     const expectedOrigin = `http://localhost:${3000}`;

    //     let verification;
    //     try {
    //         const opts = {
    //             credential: body,
    //             expectedChallenge: `${expectedChallenge}`,
    //             expectedOrigin,
    //             expectedRPID: rpID,
    //             authenticator: dbAuthenticator,
    //             requireUserVerification: true,
    //         };
    //         verification = SimpleWebAuthnServer.verifyAuthenticationResponse(opts);
    //     } catch (error) {
    //         context.log('Error', error)
    //         throw new Error(error)
    //     }

    //     const { verified, authenticationInfo } = verification;

    //     if (verified) {
    //         // Update the authenticator's counter in the DB to the newest count in the authentication
    //         dbAuthenticator.counter = authenticationInfo.newCounter;
    //     }

    //     context.log('db:', inMemoryUserDeviceDB);
    //     return { verified };

    // } catch (err) {
    //     if (err.message.includes(emulatorErrorText)) {
    //         throw new Error(invalidRequestError + ': ' + emulatorErrorText)
    //     }
    //     throw new Error(authenticateError)
    // }
}

exports.login = async (context, data) => {
    //context.log('connectUser', context, data)
    const { username, password } = data
    if (!username || !password) {
        throw new Error(invalidRequestError)
    }

    try {
        // Verify user and password
        const userId = toUserId(username)
        const userTableEntity = await table.retrieveEntity(usersTableName, userPartitionKey, userId)
        const isMatch = await bcryptCompare(password, userTableEntity.passwordHash)
        if (!isMatch) {
            throw new Error(authenticateError)
        }

        // Create user data table if it does not already exist
        const tableName = dataBaseTableName + userId
        await table.createTableIfNotExists(tableName)

        await table.createTableIfNotExists(sessionsTableName)

        // Clear previous sessions from this client
        await clearClientSessions(context)

        // Create new session id and store
        const sessionId = makeRandomId()
        const clientId = getClientId(context)
        const sessionTableEntity = toSessionTableEntity(sessionId, userId, clientId)
        await table.insertEntity(sessionsTableName, sessionTableEntity)

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

        return { data: { wDek: userTableEntity.wDek }, cookies: cookies }
    } catch (err) {
        if (err.message.includes(emulatorErrorText)) {
            throw new Error(invalidRequestError + ': ' + emulatorErrorText)
        }
        throw new Error(authenticateError)
    }
}

exports.logoff = async (context, data) => {
    await getUserId(context)

    try {
        await clearClientSessions(context)

        const clientId = getClientId(context)
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
    } catch (err) {
        throw new Error(authenticateError)
    }
}

exports.check = async (context, body) => {
    // Verify authentication
    await getUserId(context)
}


exports.tryReadBatch = async (context, body) => {
    const userId = await getUserId(context)

    try {
        const tableName = dataBaseTableName + userId

        // context.log('body', body, tableName)
        const queries = body
        const keys = queries.map(query => query.key)
        if (keys.length === 0) {
            return []
        }

        // Read all requested rows
        const rkq = ' (RowKey == ?string?' + ' || RowKey == ?string?'.repeat(keys.length - 1) + ')'
        let tableQuery = new azure.TableQuery()
            .where('PartitionKey == ?string? && ' + rkq,
                dataPartitionKey, ...keys);
        const items = await table.queryEntities(tableName, tableQuery, null)

        // Replace not modified values with status=notModified 
        const entities = items.map(item => toDataEntity(item))
        const responses = entities.map(entity => {
            if (queries.find(query => query.key === entity.key && query.IfNoneMatch === entity.etag)) {
                return { key: entity.key, etag: entity.etag, status: 'notModified' }
            }
            return entity
        })

        return responses
    } catch (err) {
        throw new Error(invalidRequestError)
    }
}


exports.writeBatch = async (context, body) => {
    const userId = await getUserId(context)

    try {
        const entities = body
        const tableName = dataBaseTableName + userId
        // context.log('entities:', entities, tableName)

        // Write all entities
        const entityItems = entities.map(entity => toDataTableEntity(entity))
        const batch = new azure.TableBatch()
        entityItems.forEach(entity => batch.insertOrReplaceEntity(entity))

        // Extract etags for written entities
        const tableResponses = await table.executeBatch(tableName, batch)
        const responses = tableResponses.map((rsp, i) => {
            if (!rsp.response || !rsp.response.isSuccessful) {
                return {
                    key: entities[i].key,
                    status: 'error'
                }
            }

            return {
                key: entities[i].key,
                etag: rsp.entity['.metadata'].etag
            }
        })

        return responses
    } catch (err) {
        throw new Error(invalidRequestError)
    }
}

exports.removeBatch = async (context, body) => {
    const userId = await getUserId(context)

    try {
        const keys = body
        const tableName = dataBaseTableName + userId
        // context.log('keys:', keys, tableName)

        const entityItems = keys.map(key => toDeleteEntityItem(key))
        const batch = new azure.TableBatch()
        entityItems.forEach(entity => batch.deleteEntity(entity))

        await table.executeBatch(tableName, batch)

        return ''
    } catch (err) {
        throw new Error(invalidRequestError)
    }
}


// // // -----------------------------------------------------------------

function getClientId(context) {
    let clientId = getCookie('clientId', context)
    if (!clientId) {
        clientId = makeRandomId()
    }

    return clientId
}

async function clearClientSessions(context) {
    const clientId = getClientId(context)

    // Get all existing sessions for the client
    let tableQuery = new azure.TableQuery()
        .where('PartitionKey == ?string? && clientId == ?string?',
            sessionsPartitionKey, clientId);
    const items = await table.queryEntities(sessionsTableName, tableQuery, null)
    const keys = items.map(item => item.RowKey)
    if (keys.length === 0) {
        return
    }

    // Remove these sessions
    const entityItems = keys.map(key => toSessionEntityItem(key))
    const batch = new azure.TableBatch()
    entityItems.forEach(entity => batch.deleteEntity(entity))
    await table.executeBatch(sessionsTableName, batch)
}


async function getUserId(context) {
    try {
        const sessionId = getCookie('sessionId', context)
        if (!sessionId) {
            throw new Error(authenticateError)
        }

        const sessionTableEntity = await table.retrieveEntity(sessionsTableName, sessionsPartitionKey, sessionId)
        return sessionTableEntity.userId
    } catch (err) {
        if (err.message.includes(emulatorErrorText)) {
            throw new Error(invalidRequestError + ': ' + emulatorErrorText)
        }
        throw new Error(authenticateError)
    }
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
        if (name == cookiePair[0].trim()) {
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

// async function delay(time) {
//     return new Promise(res => {
//         setTimeout(res, time)
//     })
// }


function toUserTableEntity(userId, passwordHash, wDek) {
    return {
        RowKey: entGen.String(userId),
        PartitionKey: entGen.String(userPartitionKey),

        passwordHash: entGen.String(passwordHash),
        wDek: entGen.String(wDek),
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

function toDataTableEntity(entity) {
    const { key, value } = entity

    const item = {
        RowKey: entGen.String(key),
        PartitionKey: entGen.String(dataPartitionKey),

        value: entGen.String(JSON.stringify(value)),
    }

    return item
}

function toDeleteEntityItem(key) {
    const item = {
        RowKey: entGen.String(key),
        PartitionKey: entGen.String(dataPartitionKey),
    }

    return item
}

function toSessionEntityItem(key) {
    const item = {
        RowKey: entGen.String(key),
        PartitionKey: entGen.String(sessionsPartitionKey),
    }

    return item
}

function toDataEntity(item) {
    let valueText = '{}'
    if (item.value) {
        valueText = item.value
    }
    const value = JSON.parse(valueText)
    return { key: item.RowKey, etag: item['odata.etag'], value: value }
}


function sha256(message) {
    return crypto.createHash("sha256")
        .update(message)
        .digest("hex");
}

function toUserId(name) {
    return sha256(name.toLowerCase()).substr(0, 32)
}