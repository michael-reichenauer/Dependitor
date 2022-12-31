const azure = require('azure-storage');
const util = require('../shared/util.js');

const tableService = azure.createTableService();

const entGen = azure.TableUtilities.entityGenerator;

// /**
//  * The default credential will use the user-assigned managed identity with the specified client ID.
//  */
// function withDefaultAzureCredential() {
//     // Alternatively, you may set the environment variable AZURE_CLIENT_ID="<MANAGED_IDENTITY_CLIENT_ID>" and omit the `managedIdentityClientId`
//     // option when using `DefaultAzureCredential` - the two approaches are equivalent.
//     const credential = new DefaultAzureCredential({
//       managedIdentityClientId: "<MANAGED_IDENTITY_CLIENT_ID>"
//     });
//     const client = new SecretClient("https://key-vault-name.vault.azure.net", credential);
//   }

// // With table URL and DefaultAzureCredential
// var client = new Client(
//     new Uri("https://127.0.0.1:10002/devstoreaccount1/table-name"), new DefaultAzureCredential()
//   );

// // With connection string
// var client = new TableClient(
//     "DefaultEndpointsProtocol=https;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;TableEndpoint=https://127.0.0.1:10002/devstoreaccount1;", "table-name"
//   );


exports.String = (value) => {
    return entGen.String(value)
}

exports.toDeleteEntity = (key, partitionKey) => {
    const item = {
        RowKey: entGen.String(key),
        PartitionKey: entGen.String(partitionKey),
    }

    return item
}

exports.createTableIfNotExists = (tableName) => {
    const stack = util.stackTrace()
    return new Promise(function (resolve, reject) {
        tableService.createTableIfNotExists(tableName, function (error, result) {
            if (error) {
                reject(withStack(error, stack));
            }
            else {
                resolve(result);
            }
        })
    });
}

exports.executeBatch = (tableName, batch) => {
    const stack = util.stackTrace()
    return new Promise(function (resolve, reject) {
        tableService.executeBatch(tableName, batch, function (error, result) {
            if (error) {
                reject(withStack(error, stack));
            }
            else {
                resolve(result);
            }
        })
    })
}

exports.insertEntity = (tableName, item) => {
    const stack = util.stackTrace()
    return new Promise(function (resolve, reject) {
        tableService.insertEntity(tableName, item, function (error, result) {
            if (error) {
                reject(withStack(error, stack));
            }
            else {
                resolve(result);
            }
        })
    })
}

exports.deleteEntity = (tableName, item) => {
    const stack = util.stackTrace()
    return new Promise(function (resolve, reject) {
        tableService.deleteEntity(tableName, item, function (error, result) {
            if (error) {
                reject(withStack(error, stack));
            }
            else {
                resolve(result);
            }
        })
    })
}

exports.insertOrReplaceEntity = (tableName, item) => {
    const stack = util.stackTrace()
    return new Promise(function (resolve, reject) {
        tableService.insertOrReplaceEntity(tableName, item, function (error, result) {
            if (error) {
                reject(withStack(error, stack));
            }
            else {
                resolve(result);
            }
        })
    })
}


exports.retrieveEntity = (tableName, partitionKey, rowKey) => {
    const stack = util.stackTrace()
    return new Promise(function (resolve, reject) {
        tableService.retrieveEntity(tableName, partitionKey, rowKey, function (error, result, response) {
            if (error) {
                reject(withStack(error, stack));
            }
            else {
                resolve(response.body);
            }
        })
    })
}


exports.queryEntities = (tableName, tableQuery, continuationToken) => {
    const stack = util.stackTrace()
    return new Promise(function (resolve, reject) {
        tableService.queryEntities(tableName, tableQuery, continuationToken, function (error, result, response) {
            if (error) {
                reject(withStack(error, stack));
            }
            else {
                resolve(response.body.value);
            }
        })
    })
}

exports.deleteTableIfExists = (tableName) => {
    const stack = util.stackTrace()
    return new Promise(function (resolve, reject) {
        tableService.deleteTableIfExists(tableName, function (error, result) {
            if (error) {
                reject(withStack(error, stack));
            }
            else {
                resolve();
            }
        })
    })
}

// Adjust the stack trace of the error to match the stack before the promise call
function withStack(error, stack) {
    error.stack = `${error.name}: ${error.message} \n${stack}`
    return error
}