@description('Specifies the location for Static Web App.')
param name string = 'DependDev'
param gitBranch string = 'master'
param location string = resourceGroup().location

@allowed([ 'prod', 'dev' ])
param environmentType string = 'dev'

output siteUrl string = 'https://${staticWebSite.properties.defaultHostname}'

var gitUrl = 'https://github.com/michael-reichenauer/Dependitor'
var storageAccountName = 'storage${uniqueString(resourceGroup().id)}'
var webSiteSkuName = (environmentType == 'prod') ? 'Standard' : 'Standard' // Change !!!

resource staticWebSite 'Microsoft.Web/staticSites@2022-03-01' = {
  name: name
  location: location
  sku: {
    name: webSiteSkuName
    tier: 'Standard'
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    repositoryUrl: gitUrl
    branch: gitBranch
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
    provider: 'GitHub'
  }

  resource symbolicname 'config' = {
    name: 'appsettings'
    kind: 'string'
    properties: {}
  }
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2022-09-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'

  properties: {
    publicNetworkAccess: 'Enabled'
    minimumTlsVersion: 'TLS1_2'
    allowSharedKeyAccess: true
    networkAcls: {
      bypass: 'AzureServices'
      virtualNetworkRules: []
      defaultAction: 'Allow'
    }
    supportsHttpsTrafficOnly: true
  }

  resource tableService 'tableServices' = {
    name: 'default'
  }
}

// resource staticSites_Dependitor_name_dependinator_com 'Microsoft.Web/staticSites/customDomains@2022-03-01' = {
//   parent: staticSites_Dependitor_name_resource
//   name: 'dependinator.com'
//   location: 'West Europe'
//   properties: {
//   }
// }

// resource staticSites_Dependitor_name_staticSites_Dependitor_name_com 'Microsoft.Web/staticSites/customDomains@2022-03-01' = {
//   parent: staticSites_Dependitor_name_resource
//   name: '${staticSites_Dependitor_name}.com'
//   location: 'West Europe'
//   properties: {
//   }
// }
