const { TableTransaction } = require("@azure/data-tables");
const table = require('../shared/table.js');
const util = require('../shared/util.js');

const dataBaseTableName = 'data'
const dataPartitionKey = 'data'
const maxValueChunkSize = 30000


exports.tryReadBatch = async (context, body, userId) => {
    try {
        const tableName = dataBaseTableName + userId

        // context.log('body', body, tableName)
        const queries = body
        const keys = queries.map(query => query.key)
        if (keys.length === 0) {
            return []
        }

        const tableClient = table.client(tableName);
        let items = [];
        for (let i = 0; i < keys.length; i++) {
            try {
                items.push(await tableClient.getEntity(dataPartitionKey, keys[i]))
            } catch {
                // Ignore errors
            }
        }

        // Read all requested rows
        // const rkq = ' (RowKey == ?string?' + ' || RowKey == ?string?'.repeat(keys.length - 1) + ')'
        // let tableQuery = new azure.TableQuery()
        //     .where('PartitionKey == ?string? && ' + rkq,
        //         dataPartitionKey, ...keys);
        // const items = await table.queryEntities(tableName, tableQuery, null)



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

        const transaction = new TableTransaction();
        entityItems.forEach(entity => transaction.upsertEntity(entity, "Replace"))

        // Extract etags for written entities
        const tableResponses = await table.client(tableName).submitTransaction(transaction.actions)
        const responses = tableResponses.subResponses.map((rsp, i) => {
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

        //const entityItems = keys.map(key => table.toDeleteEntity(key, dataPartitionKey))

        // Removing items individually to handle already removed items
        const tableClient = table.client(tableName);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            try {
                await tableClient.deleteEntity(dataPartitionKey, key)
            } catch (err) {
                if (err.code === 'ResourceNotFound') {
                    // Element already removed, not an error
                    continue
                }
                throw err
            }
        }

        return ''
    } catch (err) {
        throw util.toError(util.invalidRequestError, err)
    }
}


// // // -----------------------------------------------------------------


function toDataTableEntity(entity) {
    const { key, value } = entity

    // Convert value to string and chunk if value is big
    const valueText = JSON.stringify(value)
    const chunks = stringChunks(valueText, maxValueChunkSize)

    const item = {
        partitionKey: dataPartitionKey,
        rowKey: key,
        chunks: chunks.length,
        value: chunks[0],
    }

    // Add possible additional chunks as value1, value2, ... properties
    for (let i = 1; i < chunks.length; i++) {
        item['value' + i] = chunks[i]
    }

    return item
}


function toDataEntity(item) {
    let valueText = '{}'
    if (item.value) {
        valueText = item.value
    }

    // Concat possible value1, value2, ... properties for big values
    for (let i = 1; i < item.chunks; i++) {
        valueText = valueText.concat(item['value' + i])
    }

    const value = JSON.parse(valueText)
    return { key: item.RowKey, etag: item['odata.etag'], value: value }
}

function stringChunks(text, size) {
    if (text === '') {
        return ['']
    }

    const numChunks = Math.ceil(text.length / size);
    const chunks = new Array(numChunks);

    for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
        chunks[i] = text.substr(o, size);
    }

    return chunks;
}