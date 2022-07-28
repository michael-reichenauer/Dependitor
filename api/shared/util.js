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

exports.currentDateAdd = (duration) => {
    return new Date(new Date().getTime() + duration)
}

exports.delay = (time) => {
    return new Promise((res) => {
        setTimeout(res, time);
    });
}


exports.stackTrace = () => {
    const error = new Error();
    if (!error.stack) {
        return "";
    }

    // Skip first line to ensure the caller line is the first line
    const lines = error.stack.split("\n");
    return lines.slice(2).join("\n");
}