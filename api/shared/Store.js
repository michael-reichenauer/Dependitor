const azure = require('azure-storage');
const table = require('../shared/table.js');
const util = require('../shared/util.js');

const entGen = azure.TableUtilities.entityGenerator;

const dataBaseTableName = 'data'
const dataPartitionKey = 'data'


exports.tryReadBatch = async (context, body, userId) => {
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
        throw util.toError(util.invalidRequestError, err)
    }
}


exports.writeBatch = async (context, body, userId) => {
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
        throw util.toError(util.invalidRequestError, err)
    }
}

exports.removeBatch = async (context, body, userId) => {
    try {
        const keys = body
        const tableName = dataBaseTableName + userId
        // context.log('keys:', keys, tableName)

        const entityItems = keys.map(key => toDeleteEntityItem(key, dataPartitionKey))
        const batch = new azure.TableBatch()
        entityItems.forEach(entity => batch.deleteEntity(entity))

        await table.executeBatch(tableName, batch)

        return ''
    } catch (err) {
        throw util.toError(util.invalidRequestError, err)
    }
}


// // // -----------------------------------------------------------------


function toDataTableEntity(entity) {
    const { key, value } = entity

    const item = {
        RowKey: entGen.String(key),
        PartitionKey: entGen.String(dataPartitionKey),

        value: entGen.String(JSON.stringify(value)),
    }

    return item
}

function toDeleteEntityItem(key, dataPartitionKey) {
    const item = {
        RowKey: entGen.String(key),
        PartitionKey: entGen.String(dataPartitionKey),
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