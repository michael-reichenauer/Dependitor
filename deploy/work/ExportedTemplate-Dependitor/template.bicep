param staticSites_Dependitor_name string = 'Dependitor'
param components_Dependitor_name string = 'Dependitor'
param storageAccounts_dependitor_name string = 'dependitor'
param storageAccounts_dependitordev_name string = 'dependitordev'
param smartdetectoralertrules_failure_anomalies_dependitor_name string = 'failure anomalies - dependitor'
param actiongroups_application_insights_smart_detection_externalid string = '/subscriptions/98c1af49-6962-439b-bb35-6ce36e4c7dd1/resourceGroups/gmc/providers/microsoft.insights/actiongroups/application insights smart detection'
param workspaces_defaultworkspace_98c1af49_6962_439b_bb35_6ce36e4c7dd1_weu_externalid string = '/subscriptions/98c1af49-6962-439b-bb35-6ce36e4c7dd1/resourceGroups/defaultresourcegroup-weu/providers/microsoft.operationalinsights/workspaces/defaultworkspace-98c1af49-6962-439b-bb35-6ce36e4c7dd1-weu'

resource components_Dependitor_name_resource 'microsoft.insights/components@2020-02-02' = {
  name: components_Dependitor_name
  location: 'westeurope'
  kind: 'other'
  properties: {
    Application_Type: 'web'
    Flow_Type: 'Bluefield'
    RetentionInDays: 90
    WorkspaceResourceId: workspaces_defaultworkspace_98c1af49_6962_439b_bb35_6ce36e4c7dd1_weu_externalid
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

resource storageAccounts_dependitor_name_resource 'Microsoft.Storage/storageAccounts@2022-05-01' = {
  name: storageAccounts_dependitor_name
  location: 'swedencentral'
  sku: {
    name: 'Standard_LRS'
    tier: 'Standard'
  }
  kind: 'StorageV2'
  properties: {
    defaultToOAuthAuthentication: false
    publicNetworkAccess: 'Enabled'
    allowCrossTenantReplication: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: true
    allowSharedKeyAccess: true
    networkAcls: {
      bypass: 'AzureServices'
      virtualNetworkRules: []
      ipRules: []
      defaultAction: 'Allow'
    }
    supportsHttpsTrafficOnly: true
    encryption: {
      requireInfrastructureEncryption: false
      services: {
        file: {
          keyType: 'Account'
          enabled: true
        }
        blob: {
          keyType: 'Account'
          enabled: true
        }
      }
      keySource: 'Microsoft.Storage'
    }
    accessTier: 'Hot'
  }
}

resource storageAccounts_dependitordev_name_resource 'Microsoft.Storage/storageAccounts@2022-05-01' = {
  name: storageAccounts_dependitordev_name
  location: 'swedencentral'
  sku: {
    name: 'Standard_LRS'
    tier: 'Standard'
  }
  kind: 'StorageV2'
  properties: {
    defaultToOAuthAuthentication: false
    publicNetworkAccess: 'Enabled'
    allowCrossTenantReplication: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: true
    allowSharedKeyAccess: true
    networkAcls: {
      bypass: 'AzureServices'
      virtualNetworkRules: []
      ipRules: []
      defaultAction: 'Allow'
    }
    supportsHttpsTrafficOnly: true
    encryption: {
      requireInfrastructureEncryption: false
      services: {
        file: {
          keyType: 'Account'
          enabled: true
        }
        blob: {
          keyType: 'Account'
          enabled: true
        }
      }
      keySource: 'Microsoft.Storage'
    }
    accessTier: 'Hot'
  }
}

resource staticSites_Dependitor_name_resource 'Microsoft.Web/staticSites@2022-03-01' = {
  name: staticSites_Dependitor_name
  location: 'West Europe'
  tags: {
    'hidden-link: /app-insights-resource-id': '/subscriptions/98c1af49-6962-439b-bb35-6ce36e4c7dd1/resourceGroups/Dependitor/providers/microsoft.insights/components/Dependitor'
    'hidden-link: /app-insights-instrumentation-key': '154e4e16-491b-4b1e-b95a-f6a4048c2870'
    'hidden-link: /app-insights-conn-string': 'InstrumentationKey=154e4e16-491b-4b1e-b95a-f6a4048c2870;IngestionEndpoint=https://westeurope-5.in.applicationinsights.azure.com/;LiveEndpoint=https://westeurope.livediagnostics.monitor.azure.com/'
  }
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    repositoryUrl: 'https://github.com/michael-reichenauer/${staticSites_Dependitor_name}'
    branch: 'master'
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
    provider: 'GitHub'
    enterpriseGradeCdnStatus: 'Disabled'
  }
}

resource smartdetectoralertrules_failure_anomalies_dependitor_name_resource 'microsoft.alertsmanagement/smartdetectoralertrules@2021-04-01' = {
  name: smartdetectoralertrules_failure_anomalies_dependitor_name
  location: 'global'
  properties: {
    description: 'Failure Anomalies notifies you of an unusual rise in the rate of failed HTTP requests or dependency calls.'
    state: 'Enabled'
    severity: 'Sev3'
    frequency: 'PT1M'
    detector: {
      id: 'FailureAnomaliesDetector'
    }
    scope: [
      components_Dependitor_name_resource.id
    ]
    actionGroups: {
      groupIds: [
        actiongroups_application_insights_smart_detection_externalid
      ]
    }
  }
}

resource components_Dependitor_name_degradationindependencyduration 'microsoft.insights/components/ProactiveDetectionConfigs@2018-05-01-preview' = {
  parent: components_Dependitor_name_resource
  name: 'degradationindependencyduration'
  location: 'westeurope'
  properties: {
    RuleDefinitions: {
      Name: 'degradationindependencyduration'
      DisplayName: 'Degradation in dependency duration'
      Description: 'Smart Detection rules notify you of performance anomaly issues.'
      HelpUrl: 'https://docs.microsoft.com/en-us/azure/application-insights/app-insights-proactive-performance-diagnostics'
      IsHidden: false
      IsEnabledByDefault: true
      IsInPreview: false
      SupportsEmailNotifications: true
    }
    Enabled: true
    SendEmailsToSubscriptionOwners: true
    CustomEmails: []
  }
}

resource components_Dependitor_name_degradationinserverresponsetime 'microsoft.insights/components/ProactiveDetectionConfigs@2018-05-01-preview' = {
  parent: components_Dependitor_name_resource
  name: 'degradationinserverresponsetime'
  location: 'westeurope'
  properties: {
    RuleDefinitions: {
      Name: 'degradationinserverresponsetime'
      DisplayName: 'Degradation in server response time'
      Description: 'Smart Detection rules notify you of performance anomaly issues.'
      HelpUrl: 'https://docs.microsoft.com/en-us/azure/application-insights/app-insights-proactive-performance-diagnostics'
      IsHidden: false
      IsEnabledByDefault: true
      IsInPreview: false
      SupportsEmailNotifications: true
    }
    Enabled: true
    SendEmailsToSubscriptionOwners: true
    CustomEmails: []
  }
}

resource components_Dependitor_name_digestMailConfiguration 'microsoft.insights/components/ProactiveDetectionConfigs@2018-05-01-preview' = {
  parent: components_Dependitor_name_resource
  name: 'digestMailConfiguration'
  location: 'westeurope'
  properties: {
    RuleDefinitions: {
      Name: 'digestMailConfiguration'
      DisplayName: 'Digest Mail Configuration'
      Description: 'This rule describes the digest mail preferences'
      HelpUrl: 'www.homail.com'
      IsHidden: true
      IsEnabledByDefault: true
      IsInPreview: false
      SupportsEmailNotifications: true
    }
    Enabled: true
    SendEmailsToSubscriptionOwners: true
    CustomEmails: []
  }
}

resource components_Dependitor_name_extension_billingdatavolumedailyspikeextension 'microsoft.insights/components/ProactiveDetectionConfigs@2018-05-01-preview' = {
  parent: components_Dependitor_name_resource
  name: 'extension_billingdatavolumedailyspikeextension'
  location: 'westeurope'
  properties: {
    RuleDefinitions: {
      Name: 'extension_billingdatavolumedailyspikeextension'
      DisplayName: 'Abnormal rise in daily data volume (preview)'
      Description: 'This detection rule automatically analyzes the billing data generated by your application, and can warn you about an unusual increase in your application\'s billing costs'
      HelpUrl: 'https://github.com/Microsoft/ApplicationInsights-Home/tree/master/SmartDetection/billing-data-volume-daily-spike.md'
      IsHidden: false
      IsEnabledByDefault: true
      IsInPreview: true
      SupportsEmailNotifications: false
    }
    Enabled: true
    SendEmailsToSubscriptionOwners: true
    CustomEmails: []
  }
}

resource components_Dependitor_name_extension_canaryextension 'microsoft.insights/components/ProactiveDetectionConfigs@2018-05-01-preview' = {
  parent: components_Dependitor_name_resource
  name: 'extension_canaryextension'
  location: 'westeurope'
  properties: {
    RuleDefinitions: {
      Name: 'extension_canaryextension'
      DisplayName: 'Canary extension'
      Description: 'Canary extension'
      HelpUrl: 'https://github.com/Microsoft/ApplicationInsights-Home/blob/master/SmartDetection/'
      IsHidden: true
      IsEnabledByDefault: true
      IsInPreview: true
      SupportsEmailNotifications: false
    }
    Enabled: true
    SendEmailsToSubscriptionOwners: true
    CustomEmails: []
  }
}

resource components_Dependitor_name_extension_exceptionchangeextension 'microsoft.insights/components/ProactiveDetectionConfigs@2018-05-01-preview' = {
  parent: components_Dependitor_name_resource
  name: 'extension_exceptionchangeextension'
  location: 'westeurope'
  properties: {
    RuleDefinitions: {
      Name: 'extension_exceptionchangeextension'
      DisplayName: 'Abnormal rise in exception volume (preview)'
      Description: 'This detection rule automatically analyzes the exceptions thrown in your application, and can warn you about unusual patterns in your exception telemetry.'
      HelpUrl: 'https://github.com/Microsoft/ApplicationInsights-Home/blob/master/SmartDetection/abnormal-rise-in-exception-volume.md'
      IsHidden: false
      IsEnabledByDefault: true
      IsInPreview: true
      SupportsEmailNotifications: false
    }
    Enabled: true
    SendEmailsToSubscriptionOwners: true
    CustomEmails: []
  }
}

resource components_Dependitor_name_extension_memoryleakextension 'microsoft.insights/components/ProactiveDetectionConfigs@2018-05-01-preview' = {
  parent: components_Dependitor_name_resource
  name: 'extension_memoryleakextension'
  location: 'westeurope'
  properties: {
    RuleDefinitions: {
      Name: 'extension_memoryleakextension'
      DisplayName: 'Potential memory leak detected (preview)'
      Description: 'This detection rule automatically analyzes the memory consumption of each process in your application, and can warn you about potential memory leaks or increased memory consumption.'
      HelpUrl: 'https://github.com/Microsoft/ApplicationInsights-Home/tree/master/SmartDetection/memory-leak.md'
      IsHidden: false
      IsEnabledByDefault: true
      IsInPreview: true
      SupportsEmailNotifications: false
    }
    Enabled: true
    SendEmailsToSubscriptionOwners: true
    CustomEmails: []
  }
}

resource components_Dependitor_name_extension_securityextensionspackage 'microsoft.insights/components/ProactiveDetectionConfigs@2018-05-01-preview' = {
  parent: components_Dependitor_name_resource
  name: 'extension_securityextensionspackage'
  location: 'westeurope'
  properties: {
    RuleDefinitions: {
      Name: 'extension_securityextensionspackage'
      DisplayName: 'Potential security issue detected (preview)'
      Description: 'This detection rule automatically analyzes the telemetry generated by your application and detects potential security issues.'
      HelpUrl: 'https://github.com/Microsoft/ApplicationInsights-Home/blob/master/SmartDetection/application-security-detection-pack.md'
      IsHidden: false
      IsEnabledByDefault: true
      IsInPreview: true
      SupportsEmailNotifications: false
    }
    Enabled: true
    SendEmailsToSubscriptionOwners: true
    CustomEmails: []
  }
}

resource components_Dependitor_name_extension_traceseveritydetector 'microsoft.insights/components/ProactiveDetectionConfigs@2018-05-01-preview' = {
  parent: components_Dependitor_name_resource
  name: 'extension_traceseveritydetector'
  location: 'westeurope'
  properties: {
    RuleDefinitions: {
      Name: 'extension_traceseveritydetector'
      DisplayName: 'Degradation in trace severity ratio (preview)'
      Description: 'This detection rule automatically analyzes the trace logs emitted from your application, and can warn you about unusual patterns in the severity of your trace telemetry.'
      HelpUrl: 'https://github.com/Microsoft/ApplicationInsights-Home/blob/master/SmartDetection/degradation-in-trace-severity-ratio.md'
      IsHidden: false
      IsEnabledByDefault: true
      IsInPreview: true
      SupportsEmailNotifications: false
    }
    Enabled: true
    SendEmailsToSubscriptionOwners: true
    CustomEmails: []
  }
}

resource components_Dependitor_name_longdependencyduration 'microsoft.insights/components/ProactiveDetectionConfigs@2018-05-01-preview' = {
  parent: components_Dependitor_name_resource
  name: 'longdependencyduration'
  location: 'westeurope'
  properties: {
    RuleDefinitions: {
      Name: 'longdependencyduration'
      DisplayName: 'Long dependency duration'
      Description: 'Smart Detection rules notify you of performance anomaly issues.'
      HelpUrl: 'https://docs.microsoft.com/en-us/azure/application-insights/app-insights-proactive-performance-diagnostics'
      IsHidden: false
      IsEnabledByDefault: true
      IsInPreview: false
      SupportsEmailNotifications: true
    }
    Enabled: true
    SendEmailsToSubscriptionOwners: true
    CustomEmails: []
  }
}

resource components_Dependitor_name_migrationToAlertRulesCompleted 'microsoft.insights/components/ProactiveDetectionConfigs@2018-05-01-preview' = {
  parent: components_Dependitor_name_resource
  name: 'migrationToAlertRulesCompleted'
  location: 'westeurope'
  properties: {
    RuleDefinitions: {
      Name: 'migrationToAlertRulesCompleted'
      DisplayName: 'Migration To Alert Rules Completed'
      Description: 'A configuration that controls the migration state of Smart Detection to Smart Alerts'
      HelpUrl: 'https://docs.microsoft.com/en-us/azure/application-insights/app-insights-proactive-performance-diagnostics'
      IsHidden: true
      IsEnabledByDefault: false
      IsInPreview: true
      SupportsEmailNotifications: false
    }
    Enabled: false
    SendEmailsToSubscriptionOwners: true
    CustomEmails: []
  }
}

resource components_Dependitor_name_slowpageloadtime 'microsoft.insights/components/ProactiveDetectionConfigs@2018-05-01-preview' = {
  parent: components_Dependitor_name_resource
  name: 'slowpageloadtime'
  location: 'westeurope'
  properties: {
    RuleDefinitions: {
      Name: 'slowpageloadtime'
      DisplayName: 'Slow page load time'
      Description: 'Smart Detection rules notify you of performance anomaly issues.'
      HelpUrl: 'https://docs.microsoft.com/en-us/azure/application-insights/app-insights-proactive-performance-diagnostics'
      IsHidden: false
      IsEnabledByDefault: true
      IsInPreview: false
      SupportsEmailNotifications: true
    }
    Enabled: true
    SendEmailsToSubscriptionOwners: true
    CustomEmails: []
  }
}

resource components_Dependitor_name_slowserverresponsetime 'microsoft.insights/components/ProactiveDetectionConfigs@2018-05-01-preview' = {
  parent: components_Dependitor_name_resource
  name: 'slowserverresponsetime'
  location: 'westeurope'
  properties: {
    RuleDefinitions: {
      Name: 'slowserverresponsetime'
      DisplayName: 'Slow server response time'
      Description: 'Smart Detection rules notify you of performance anomaly issues.'
      HelpUrl: 'https://docs.microsoft.com/en-us/azure/application-insights/app-insights-proactive-performance-diagnostics'
      IsHidden: false
      IsEnabledByDefault: true
      IsInPreview: false
      SupportsEmailNotifications: true
    }
    Enabled: true
    SendEmailsToSubscriptionOwners: true
    CustomEmails: []
  }
}

resource storageAccounts_dependitor_name_default 'Microsoft.Storage/storageAccounts/blobServices@2022-05-01' = {
  parent: storageAccounts_dependitor_name_resource
  name: 'default'
  sku: {
    name: 'Standard_LRS'
    tier: 'Standard'
  }
  properties: {
    changeFeed: {
      enabled: false
    }
    restorePolicy: {
      enabled: false
    }
    containerDeleteRetentionPolicy: {
      enabled: true
      days: 7
    }
    cors: {
      corsRules: []
    }
    deleteRetentionPolicy: {
      allowPermanentDelete: false
      enabled: true
      days: 7
    }
    isVersioningEnabled: false
  }
}

resource storageAccounts_dependitordev_name_default 'Microsoft.Storage/storageAccounts/blobServices@2022-05-01' = {
  parent: storageAccounts_dependitordev_name_resource
  name: 'default'
  sku: {
    name: 'Standard_LRS'
    tier: 'Standard'
  }
  properties: {
    changeFeed: {
      enabled: false
    }
    restorePolicy: {
      enabled: false
    }
    containerDeleteRetentionPolicy: {
      enabled: true
      days: 7
    }
    cors: {
      corsRules: []
    }
    deleteRetentionPolicy: {
      allowPermanentDelete: false
      enabled: true
      days: 7
    }
    isVersioningEnabled: false
  }
}

resource Microsoft_Storage_storageAccounts_fileServices_storageAccounts_dependitor_name_default 'Microsoft.Storage/storageAccounts/fileServices@2022-05-01' = {
  parent: storageAccounts_dependitor_name_resource
  name: 'default'
  sku: {
    name: 'Standard_LRS'
    tier: 'Standard'
  }
  properties: {
    protocolSettings: {
      smb: {
      }
    }
    cors: {
      corsRules: []
    }
    shareDeleteRetentionPolicy: {
      enabled: true
      days: 7
    }
  }
}

resource Microsoft_Storage_storageAccounts_fileServices_storageAccounts_dependitordev_name_default 'Microsoft.Storage/storageAccounts/fileServices@2022-05-01' = {
  parent: storageAccounts_dependitordev_name_resource
  name: 'default'
  sku: {
    name: 'Standard_LRS'
    tier: 'Standard'
  }
  properties: {
    protocolSettings: {
      smb: {
      }
    }
    cors: {
      corsRules: []
    }
    shareDeleteRetentionPolicy: {
      enabled: true
      days: 7
    }
  }
}

resource Microsoft_Storage_storageAccounts_queueServices_storageAccounts_dependitor_name_default 'Microsoft.Storage/storageAccounts/queueServices@2022-05-01' = {
  parent: storageAccounts_dependitor_name_resource
  name: 'default'
  properties: {
    cors: {
      corsRules: []
    }
  }
}

resource Microsoft_Storage_storageAccounts_queueServices_storageAccounts_dependitordev_name_default 'Microsoft.Storage/storageAccounts/queueServices@2022-05-01' = {
  parent: storageAccounts_dependitordev_name_resource
  name: 'default'
  properties: {
    cors: {
      corsRules: []
    }
  }
}

resource Microsoft_Storage_storageAccounts_tableServices_storageAccounts_dependitor_name_default 'Microsoft.Storage/storageAccounts/tableServices@2022-05-01' = {
  parent: storageAccounts_dependitor_name_resource
  name: 'default'
  properties: {
    cors: {
      corsRules: []
    }
  }
}

resource Microsoft_Storage_storageAccounts_tableServices_storageAccounts_dependitordev_name_default 'Microsoft.Storage/storageAccounts/tableServices@2022-05-01' = {
  parent: storageAccounts_dependitordev_name_resource
  name: 'default'
  properties: {
    cors: {
      corsRules: []
    }
  }
}

resource staticSites_Dependitor_name_dependinator_com 'Microsoft.Web/staticSites/customDomains@2022-03-01' = {
  parent: staticSites_Dependitor_name_resource
  name: 'dependinator.com'
  location: 'West Europe'
  properties: {
  }
}

resource staticSites_Dependitor_name_staticSites_Dependitor_name_com 'Microsoft.Web/staticSites/customDomains@2022-03-01' = {
  parent: staticSites_Dependitor_name_resource
  name: '${staticSites_Dependitor_name}.com'
  location: 'West Europe'
  properties: {
  }
}

resource storageAccounts_dependitor_name_default_authenticator 'Microsoft.Storage/storageAccounts/tableServices/tables@2022-05-01' = {
  parent: Microsoft_Storage_storageAccounts_tableServices_storageAccounts_dependitor_name_default
  name: 'authenticator'
  properties: {
  }
  dependsOn: [

    storageAccounts_dependitor_name_resource
  ]
}

resource storageAccounts_dependitordev_name_default_authenticator 'Microsoft.Storage/storageAccounts/tableServices/tables@2022-05-01' = {
  parent: Microsoft_Storage_storageAccounts_tableServices_storageAccounts_dependitordev_name_default
  name: 'authenticator'
  properties: {
  }
  dependsOn: [

    storageAccounts_dependitordev_name_resource
  ]
}

resource storageAccounts_dependitor_name_default_data119d6ea30950230bf6f1f618f5ff281b 'Microsoft.Storage/storageAccounts/tableServices/tables@2022-05-01' = {
  parent: Microsoft_Storage_storageAccounts_tableServices_storageAccounts_dependitor_name_default
  name: 'data119d6ea30950230bf6f1f618f5ff281b'
  properties: {
  }
  dependsOn: [

    storageAccounts_dependitor_name_resource
  ]
}

resource storageAccounts_dependitordev_name_default_data793beff47ac17212ead0c6752ed20eda 'Microsoft.Storage/storageAccounts/tableServices/tables@2022-05-01' = {
  parent: Microsoft_Storage_storageAccounts_tableServices_storageAccounts_dependitordev_name_default
  name: 'data793beff47ac17212ead0c6752ed20eda'
  properties: {
  }
  dependsOn: [

    storageAccounts_dependitordev_name_resource
  ]
}

resource storageAccounts_dependitor_name_default_data85ed40869a5937aed6c61b99939c30cf 'Microsoft.Storage/storageAccounts/tableServices/tables@2022-05-01' = {
  parent: Microsoft_Storage_storageAccounts_tableServices_storageAccounts_dependitor_name_default
  name: 'data85ed40869a5937aed6c61b99939c30cf'
  properties: {
  }
  dependsOn: [

    storageAccounts_dependitor_name_resource
  ]
}

resource storageAccounts_dependitor_name_default_data970dd6309d0ecdc1875ed2eaebd000dc 'Microsoft.Storage/storageAccounts/tableServices/tables@2022-05-01' = {
  parent: Microsoft_Storage_storageAccounts_tableServices_storageAccounts_dependitor_name_default
  name: 'data970dd6309d0ecdc1875ed2eaebd000dc'
  properties: {
  }
  dependsOn: [

    storageAccounts_dependitor_name_resource
  ]
}

resource storageAccounts_dependitor_name_default_data97c8b954ec3d2b3c5428ada2f11948a5 'Microsoft.Storage/storageAccounts/tableServices/tables@2022-05-01' = {
  parent: Microsoft_Storage_storageAccounts_tableServices_storageAccounts_dependitor_name_default
  name: 'data97c8b954ec3d2b3c5428ada2f11948a5'
  properties: {
  }
  dependsOn: [

    storageAccounts_dependitor_name_resource
  ]
}

resource storageAccounts_dependitor_name_default_datacb326a1219b9446cfebf2411a82466f3 'Microsoft.Storage/storageAccounts/tableServices/tables@2022-05-01' = {
  parent: Microsoft_Storage_storageAccounts_tableServices_storageAccounts_dependitor_name_default
  name: 'datacb326a1219b9446cfebf2411a82466f3'
  properties: {
  }
  dependsOn: [

    storageAccounts_dependitor_name_resource
  ]
}

resource storageAccounts_dependitor_name_default_datad98bcf78a534c7627b6ed5b5b961b8f8 'Microsoft.Storage/storageAccounts/tableServices/tables@2022-05-01' = {
  parent: Microsoft_Storage_storageAccounts_tableServices_storageAccounts_dependitor_name_default
  name: 'datad98bcf78a534c7627b6ed5b5b961b8f8'
  properties: {
  }
  dependsOn: [

    storageAccounts_dependitor_name_resource
  ]
}

resource storageAccounts_dependitordev_name_default_datae89a0a952264264bfbb50581fc49ec82 'Microsoft.Storage/storageAccounts/tableServices/tables@2022-05-01' = {
  parent: Microsoft_Storage_storageAccounts_tableServices_storageAccounts_dependitordev_name_default
  name: 'datae89a0a952264264bfbb50581fc49ec82'
  properties: {
  }
  dependsOn: [

    storageAccounts_dependitordev_name_resource
  ]
}

resource storageAccounts_dependitordev_name_default_dataf5f87f7f77e100b2a0a1efdd671ade84 'Microsoft.Storage/storageAccounts/tableServices/tables@2022-05-01' = {
  parent: Microsoft_Storage_storageAccounts_tableServices_storageAccounts_dependitordev_name_default
  name: 'dataf5f87f7f77e100b2a0a1efdd671ade84'
  properties: {
  }
  dependsOn: [

    storageAccounts_dependitordev_name_resource
  ]
}

resource storageAccounts_dependitor_name_default_sessions 'Microsoft.Storage/storageAccounts/tableServices/tables@2022-05-01' = {
  parent: Microsoft_Storage_storageAccounts_tableServices_storageAccounts_dependitor_name_default
  name: 'sessions'
  properties: {
  }
  dependsOn: [

    storageAccounts_dependitor_name_resource
  ]
}

resource storageAccounts_dependitordev_name_default_sessions 'Microsoft.Storage/storageAccounts/tableServices/tables@2022-05-01' = {
  parent: Microsoft_Storage_storageAccounts_tableServices_storageAccounts_dependitordev_name_default
  name: 'sessions'
  properties: {
  }
  dependsOn: [

    storageAccounts_dependitordev_name_resource
  ]
}

resource storageAccounts_dependitor_name_default_users 'Microsoft.Storage/storageAccounts/tableServices/tables@2022-05-01' = {
  parent: Microsoft_Storage_storageAccounts_tableServices_storageAccounts_dependitor_name_default
  name: 'users'
  properties: {
  }
  dependsOn: [

    storageAccounts_dependitor_name_resource
  ]
}

resource storageAccounts_dependitordev_name_default_users 'Microsoft.Storage/storageAccounts/tableServices/tables@2022-05-01' = {
  parent: Microsoft_Storage_storageAccounts_tableServices_storageAccounts_dependitordev_name_default
  name: 'users'
  properties: {
  }
  dependsOn: [

    storageAccounts_dependitordev_name_resource
  ]
}