const { TableServiceClient, TableClient } = require("@azure/data-tables");
const { DefaultAzureCredential } = require("@azure/identity");

const account = ''

exports.dataTableName = 'data'

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


const tableService = () => {
    if (process.env.AZURE_STORAGE_CONNECTION_STRING) {
        return TableServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
    }

    const credential = new DefaultAzureCredential();
    return new TableServiceClient(`https://${account}.table.core.windows.net`,
        credential
    );
}