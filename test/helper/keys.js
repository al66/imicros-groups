// mock service rules
const Keys = {
    name: "keys",
    actions: {
        encrypt: {
            params: {
                token: { type: "string" },
                data: { type: "any" }
            },
            async handler(ctx) {
                this.logger.info("keys encrypt called", { token: ctx.params.token, data: ctx.params.data } );
                let container = {
                    data: ctx.params.data
                };
                return JSON.stringify(container);
            }
        },
        decrypt: {
            params: {
                token: { type: "string" },
                data: { type: "any" }
            },
            async handler(ctx) {
                this.logger.info("keys decrypt called", { token: ctx.params.token, data: ctx.params.data } );
                let container = JSON.parse(ctx.params.data);
                return container.data;
            }
        }
    }
};

module.exports = {
    Keys
};
