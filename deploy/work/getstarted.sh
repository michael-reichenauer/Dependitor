
# Export group
az group export --name demoGroup > exportedtemplate.json

# Decompile ARM template to bicep
az bicep decompile --file template.json