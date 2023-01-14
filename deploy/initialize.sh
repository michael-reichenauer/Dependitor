# A few command to setup azure and connect repo to azure
# These commands must be run manually once and creates nessassary credentials 
# and resource groups so the deployments can works automaticaly

# Install azure cli in shell (https://learn.microsoft.com/en-us/cli/azure/install-azure-cli )
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Install/upgrade bicep
az bicep install && az bicep upgrade

# Login to Azure with azure cli
az login

location='westeurope'
groupName='DependitorDev'


# Create resource group
az group create --location $location --name $groupName

# Delete resource group
az group delete --name  $groupName

# Deploy a bicep template to resource group
az deployment group create -g $groupName -f main.bicep









