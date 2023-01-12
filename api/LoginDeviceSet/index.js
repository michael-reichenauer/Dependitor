const auth = require('../shared/auth.js');


module.exports = async function (context, req) {
    try {
        auth.verifyApiKey(context)
        const userId = await auth.getLoginUserId(context)

        const response = await auth.loginDeviceSet(context, req.body, userId)

        context.res = { status: 200, body: response };
    } catch (err) {
        // context.log.error('error:', err.message);
        context.res = { status: 400, body: `error: '${err.message}'` };
    }
}