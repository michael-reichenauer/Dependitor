const second = 1000
const minute = 60 * second
const hour = 60 * minute
const day = 24 * hour
const invalidRequestError = 'InvalidRequestError'
const authenticateError = 'AuthenticateError'
const sessionError = 'SessionError'

exports.second = second
exports.minute = minute
exports.hour = hour
exports.day = day
exports.invalidRequestError = invalidRequestError
exports.authenticateError = authenticateError
exports.sessionError = sessionError

const isIncludeExceptionsDetails = true


exports.toError = (errorMsg, error) => {
    const exceptionDetails = isIncludeExceptionsDetails ?
        `\ncaused by server error:\n${error.stack}\n---- end of server error ----` :
        ''
    return new Error(`${errorMsg}${exceptionDetails}`)
}


exports.delay = (time) => {
    return new Promise((res) => {
        setTimeout(res, time);
    });
}
