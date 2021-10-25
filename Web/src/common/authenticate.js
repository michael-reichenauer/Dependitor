import Api from "../application/diagram/Api";
import { store } from "../application/diagram/Store";


class Authenticate {
    api = new Api()

    async createUser(user) {
        // Reduce risk of clear text password logging
        user.password = await authenticate.passwordHash(user.password)

        await this.api.createUser(user)
    }

    async connectUser(user) {
        user.password = await authenticate.passwordHash(user.password)
        return await store.connectUser(user)
    }


    async passwordHash(text) {
        // encode as UTF-8
        const msgBuffer = new TextEncoder().encode(text);

        // hash the message
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);

        // convert ArrayBuffer to Array
        const hashArray = Array.from(new Uint8Array(hashBuffer));

        // convert bytes to hex string                  
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }
}

export const authenticate = new Authenticate()