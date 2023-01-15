// const azure = require('azure-storage');
// const util = require('../shared/util.js');
const { TableServiceClient, TableClient } = require("@azure/data-tables");
const { DefaultAzureCredential } = require("@azure/identity");

const account = ''

// Alternatively, you may set the environment variable AZURE_CLIENT_ID="<MANAGED_IDENTITY_CLIENT_ID>" and omit the `managedIdentityClientId`
// option when using `DefaultAzureCredential` - the two approaches are equivalent.
// const managedIdentity = ''
// const credential = new DefaultAzureCredential({
//     managedIdentityClientId: managedIdentity
// });

// const tableService = azure.createTableService();

// const entGen = azure.TableUtilities.entityGenerator;

// const tableService2 = TableServiceClient.fromConnectionString("UseDevelopmentStorage=true;");

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


const tableService = () => {
    if (process.env.AZURE_STORAGE_CONNECTION_STRING) {
        return TableServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
    }

    const credential = new DefaultAzureCredential();
    return new TableServiceClient(`https://${account}.table.core.windows.net`,
        credential
    );
}

exports.createTable = (tableName) => {
    return tableService().createTable(tableName)
}



exports.client = (tableName) => {
    if (process.env.AZURE_STORAGE_CONNECTION_STRING) {
        return TableClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING, tableName);
    }

    const credential = new DefaultAzureCredential();
    return new TableClient(`https://${account}.table.core.windows.net`,
        tableName, credential);
}


// exports.String = (value) => {
//     return entGen.String(value)
// }

// exports.toDeleteEntity = (key, partitionKey) => {
//     const item = {
//         RowKey: entGen.String(key),
//         PartitionKey: entGen.String(partitionKey),
//     }

//     return item
// }

// exports.createTableIfNotExistsXX = (tableName) => {
//     const stack = util.stackTrace()
//     return new Promise(function (resolve, reject) {
//         tableService.createTableIfNotExists(tableName, function (error, result) {
//             if (error) {
//                 reject(withStack(error, stack));
//             }
//             else {
//                 resolve(result);
//             }
//         })
//     });
// }

// exports.executeBatch = (tableName, batch) => {
//     const stack = util.stackTrace()
//     return new Promise(function (resolve, reject) {
//         tableService.executeBatch(tableName, batch, function (error, result) {
//             if (error) {
//                 reject(withStack(error, stack));
//             }
//             else {
//                 resolve(result);
//             }
//         })
//     })
// }

// exports.insertEntity = (tableName, item) => {
//     const stack = util.stackTrace()
//     return new Promise(function (resolve, reject) {
//         tableService.insertEntity(tableName, item, function (error, result) {
//             if (error) {
//                 reject(withStack(error, stack));
//             }
//             else {
//                 resolve(result);
//             }
//         })
//     })
// }

// exports.insertEntity2 = (tableName, item) => {
//     const stack = util.stackTrace()
//     return tableService2.insertEntity()
//     })
// }


// exports.deleteEntity = (tableName, item) => {
//     const stack = util.stackTrace()
//     return new Promise(function (resolve, reject) {
//         tableService.deleteEntity(tableName, item, function (error, result) {
//             if (error) {
//                 reject(withStack(error, stack));
//             }
//             else {
//                 resolve(result);
//             }
//         })
//     })
// }

// exports.insertOrReplaceEntity = (tableName, item) => {
//     const stack = util.stackTrace()
//     return new Promise(function (resolve, reject) {
//         tableService.insertOrReplaceEntity(tableName, item, function (error, result) {
//             if (error) {
//                 reject(withStack(error, stack));
//             }
//             else {
//                 resolve(result);
//             }
//         })
//     })
// }


// exports.retrieveEntity = (tableName, partitionKey, rowKey) => {
//     const stack = util.stackTrace()
//     return new Promise(function (resolve, reject) {
//         tableService.retrieveEntity(tableName, partitionKey, rowKey, function (error, result, response) {
//             if (error) {
//                 reject(withStack(error, stack));
//             }
//             else {
//                 resolve(response.body);
//             }
//         })
//     })
// }

// exports.retrieveEntity = (tableName, partitionKey, rowKey) => {
//     const stack = util.stackTrace()
//     return new Promise(function (resolve, reject) {
//         tableService.retrieveEntity(tableName, partitionKey, rowKey, function (error, result, response) {
//             if (error) {
//                 reject(withStack(error, stack));
//             }
//             else {
//                 resolve(response.body);
//             }
//         })
//     })
// }


// exports.queryEntities = (tableName, tableQuery, continuationToken) => {
//     const stack = util.stackTrace()
//     return new Promise(function (resolve, reject) {
//         tableService.queryEntities(tableName, tableQuery, continuationToken, function (error, result, response) {
//             if (error) {
//                 reject(withStack(error, stack));
//             }
//             else {
//                 resolve(response.body.value);
//             }
//         })
//     })
// }

// exports.deleteTableIfExists = (tableName) => {
//     const stack = util.stackTrace()
//     return new Promise(function (resolve, reject) {
//         tableService.deleteTableIfExists(tableName, function (error, result) {
//             if (error) {
//                 reject(withStack(error, stack));
//             }
//             else {
//                 resolve();
//             }
//         })
//     })
// }

// exports.deleteTable = (tableName) => {
//     return tableService2.deleteTable(tableName);
// }

// Adjust the stack trace of the error to match the stack before the promise call
// function withStack(error, stack) {
//     error.stack = `${error.name}: ${error.message} \n${stack}`
//     return error
// }