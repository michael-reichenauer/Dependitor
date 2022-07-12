var store = require('../shared/Store.js');

module.exports = async function (context, req) {
    try {
        store.verifyApiKey(context)
        const { response, cookies } = await store.verifyWebAuthnAuthentication(context, req.body)

        context.res = { status: 200, body: response, cookies: cookies };
    } catch (err) {
        context.log.error('error:', err.message);
        context.res = { status: 400, body: `error: '${err.message}'` };

    }
}