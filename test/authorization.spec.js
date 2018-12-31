"use strict";

const { ServiceBroker } = require("moleculer");
const { Authorization } = require("../index");
const { GroupsNotAuthorized,
        GroupsUpdate   
      } = require("../index").Errors;

const timestamp = Date.now();

const mockGroups = {
    name: "mockGroups",
    actions: {
        isAuthorized: {
            params: {
                resId: [
                  { type: "string" },
                  { type: "number" }
                ],
                action: { type: "string" }
            },
            handler(ctx) {
                if (ctx.params.resId == "FAIL") return null;
                let res = [ { owner: false, service: "granted_service", action: ctx.params.action } ]; 
                return res;
            }
        },
        addRessource: {
            params: {
                resId: [
                  { type: "string" },
                  { type: "number" }
                ],
                getAction: { type: "string", optional: true }
            },
            handler(ctx) {
                if (!ctx.params.service == "mockService") return null;
                if (ctx.params.resId == "FAIL") return null;
                let res = [{ id: ctx.params.resId }]
                return res;
            }
        },
    }
}

const mockService = {
    name: "mockService",
    mixins: [Authorization],
    actions: {
        isAuthorized: {
            handler(ctx) {
                return this.isAuthorized(ctx.params)
            }
        },
        registerRessource: {
            handler(ctx) {
                return this.registerRessource(ctx.params)
            }
        }
    }
}

beforeAll( async () => {
});

afterAll( async () => {
});

describe("Test group service", () => {

    let broker, services = {};
    beforeAll( async () => {
        broker = new ServiceBroker({
            logger: console
        });
        services.groups = broker.createService(mockGroups);
        services.test = broker.createService(mockService, Object.assign({ 
            settings: { 
                groupsService: "mockGroups"
            } 
        }));
        services.groupsDefault = broker.createService(mockGroups, Object.assign({ 
            name: "groups"
        }));
        services.withDefaultName = broker.createService(mockService, Object.assign({ 
            name: "mockServiceDefaultName"
        }));
        return broker.start();
    });

    afterAll(async (done) => {
        await broker.stop().then(() => done());
    });
    
    describe("Test create service", () => {

        it("it should be created", () => {
            expect(services.groups).toBeDefined();
            expect(services.test).toBeDefined();
            expect(services.withDefaultName).toBeDefined();
        });

    });

    describe("Test registerRessource", () => {

        let opts, id;
        beforeEach(() => {
            opts = { meta: { user: { id: `1-${timestamp}` , email: `1-${timestamp}@host.com` } } };
        });
        
        it("it should return registered ressource", () => {
            let params = {
                resId: "RES_1"
            };
            return broker.call("mockService.registerRessource", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toEqual(params.resId);
            });
        });

        it("it should return also registered ressource", () => {
            let params = {
                resId: "RES_2"
            };
            return broker.call("mockServiceDefaultName.registerRessource", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toEqual(params.resId);
            });
        });

        it("it should throw GroupsUpdate error", () => {
            let params = {
                resId: "FAIL"
            };
            return broker.call("mockService.registerRessource", params, opts).catch(err => {
                expect(err instanceof GroupsUpdate).toBe(true);
            });
        });

    });
    
    describe("Test isAuthorized", () => {

        let opts, id;
        beforeEach(() => {
            opts = { meta: { user: { id: `1-${timestamp}`, email: `1-${timestamp}@host.com` } } };
        });

        it("it should return true", () => {
            let params = {
                resId: "RES_1",
                action: "WRITE"
            };
            return broker.call("mockService.isAuthorized", params, opts).then(res => {
                expect(res).toBeDefined();
                //expect(res[0]).toEqual(expect.objectContaining(params));
                expect(res).toEqual(true);
            });
        });

        it("it should throw GroupsNotAuthorized error", () => {
            let params = {
                resId: "FAIL",
                action: "WRITE"
            };
            return broker.call("mockService.isAuthorized", params, opts).catch(err => {
                expect(err instanceof GroupsNotAuthorized).toBe(true);
            });
        });

    });

});