"use strict";

const { ServiceBroker } = require("moleculer");
const { Groups } = require("../index");
const { GroupsNotAuthenticated,
    GroupsUpdate   
} = require("../index").Errors;
const crypto = require("crypto");
const { v4: uuid } = require("uuid");
const { Keys } = require("./helper/keys");

const timestamp = Date.now();

process.env.SERVICE_TOKEN = "bVTWhK7G2ASfoMjVAiUhSLHq2P5p8135PEm+0GRvo4X=";
process.env.ADMIN_GROUP_ID = uuid();
process.env.ADMIN_GROUP_NAME = "imciros administration " + timestamp;
process.env.ADMIN_GROUP_MEMBER = `admin-${timestamp}@host.com`;

function getHash(value) {
    return crypto.createHash("sha256")
        .update(value)
        .digest("hex");
}

beforeAll( async () => {
});

afterAll( async () => {
});

describe("Test group service", () => {

    let broker, service;
    beforeAll(() => {});

    afterAll(() => {});
    
    describe("Test create service", () => {

        let initialGroupId;
        
        it("it should be created", async () => {
            broker = new ServiceBroker({
                logger: console
            });
            service = broker.createService(Groups, Object.assign({ 
                settings: { 
                    uri: process.env.URI || "bolt://localhost:7687",
                    user: "neo4j",
                    password: "neo4j"
                } 
            }));
            broker.createService(Keys);
            await broker.start();
            expect(service).toBeDefined();
        });
        
        it("it should return initial group", () => {
            let opts = { meta: { user: { id: `admin-${timestamp}`, email: `admin-${timestamp}@host.com` } } };
            let params = {
                limit: 100
            };
            return broker.call("groups.list", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(Array.isArray(res)).toEqual(true);
                expect(res.length).toEqual(1);
                expect(res[0]).toEqual(expect.objectContaining({ name: "imciros administration " + timestamp }));
                initialGroupId = res[0].id;
            });
        });

        it("it should add user as admin", () => {
            let opts = { meta: { user: { id: `admin-${timestamp}`, email: `admin-${timestamp}@host.com` } } };
            let params = {
                id: initialGroupId
            };
            return broker.call("groups.join", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({ id: initialGroupId, role: "admin" }));
            });
        });        

    });

    describe("Test create entry", () => {

        let opts, id;
        beforeEach(() => {
            opts = { meta: { user: { id: `1-${timestamp}` , email: `1-${timestamp}@host.com` } } };
        });
        
        it("it should return created entry with id", () => {
            let params = {
                name: "group to be created"
            };
            return broker.call("groups.add", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res[0]).toEqual(expect.objectContaining(params));
                id = res[0].id;
            });
        });

        it("it should return members", () => {
            let params = {
                id: id
            };
            return broker.call("groups.members", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({ key: getHash(`1-${timestamp}@host.com`), id: `1-${timestamp}`, role: "admin", relation: "MEMBER_OF", email: `1-${timestamp}@host.com` }));
            });
        });
    
        it("it should return new group", () => {
            let params = {
                id: id
            };
            return broker.call("groups.get", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res[0]).toEqual(expect.objectContaining({
                    id: id,
                    name: "group to be created",
                    relation: "MEMBER_OF",
                    role: "admin"
                }));
            });
        });
        
        it("it should update name", () => {
            let params = {
                id: id,
                name: "group renamed"
            };
            return broker.call("groups.rename", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res[0]).toEqual(expect.objectContaining(params));
            });
        });

        it("it should return new name", () => {
            let params = {
                id: id
            };
            return broker.call("groups.get", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res[0]).toEqual(expect.objectContaining({
                    id: id,
                    name: "group renamed",
                    relation: "MEMBER_OF",
                    role: "admin"
                }));
            });
        });

        it("it should throw error GroupsNotAuthenticated", async () => {
            opts = { meta: { user: { } } };
            let params = {
                name: "group to be created"
            };
            expect.assertions(2);
            await broker.call("groups.add", params, opts).catch(err => {
                expect(err instanceof GroupsNotAuthenticated).toBe(true);
                expect(err.message).toEqual("not authenticated");
            });
        });        

        it("it should throw error GroupsNotAuthenticated", async () => {
            opts = { meta: { user: { } } };
            let params = {
                id: id
            };
            expect.assertions(2);
            await broker.call("groups.get", params, opts).catch(err => {
                expect(err instanceof GroupsNotAuthenticated).toBe(true);
                expect(err.message).toEqual("not authenticated");
            });
        });        
        
        it("it should throw error GroupsNotAuthenticated", async () => {
            opts = { meta: { user: { } } };
            let params = {
                id: id,
                name: "group renamed"
            };
            expect.assertions(2);
            await broker.call("groups.rename", params, opts).catch(err => {
                expect(err instanceof GroupsNotAuthenticated).toBe(true);
                expect(err.message).toEqual("not authenticated");
            });
        });        
        
        it("it should return empty array (group does not exist)", async () => {
            let params = {
                id: id.replace(/...$/,"999")
            };
            return broker.call("groups.get", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toEqual([]);
            });
        });        

        it("it should return empty array (group does not exist)", async () => {
            let params = {
                id: id.replace(/...$/,"999"),
                name: "group renamed"
            };
            return broker.call("groups.rename", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toEqual([]);
            });
        });        

    });
    
    describe("Test join group", () => {

        let opts, id;
        beforeEach(() => {
            opts = { meta: { user: { id: `1-${timestamp}`, email: `1-${timestamp}@host.com` } } };
        });

        it("it should return id for created entry", () => {
            let params = {
                name: "group to be joined"
            };
            return broker.call("groups.add", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res[0]).toEqual(expect.objectContaining(params));
                expect(res[0].id).toBeDefined();
                id = res[0].id;
            });
        });

        it("it should return empty array (user does not belong to any group)", async () => {
            let opts = { meta: { user: { id: `2-${timestamp}`, email: `2-${timestamp}@host.com` } } };
            let params = {
                id: id
            };
            return broker.call("groups.members", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toEqual([]);
            });
        });

        it("it should create another group", () => {
            let opts = { meta: { user: { id: `2-${timestamp}`, email: `2-${timestamp}@host.com` } } };
            let params = {
                name: "group other user"
            };
            return broker.call("groups.add", params, opts).then(res => {
                expect(res[0].id).toBeDefined();
                expect(res[0]).toEqual(expect.objectContaining(params));
            });
        });
        
        it("it should invite user", () => {
            let params = {
                id: id, 
                email: `3-${timestamp}@host.com`
            };
            return broker.call("groups.invite", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res[0].invited).toBeDefined();
                expect(res[0].invited).toEqual(getHash(`3-${timestamp}@host.com`));
            });
        });

        it("it should return invited member", () => {
            let params = {
                id: id
            };
            return broker.call("groups.invitations", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({ key: getHash(`3-${timestamp}@host.com`) }));
            });
        });
        
        it("it should return all members including invited member", async () => {
            let params = {
                id: id
            };
            return broker.call("groups.members", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({ key: getHash(`3-${timestamp}@host.com`), email: `3-${timestamp}@host.com` }));
            });
        });

        it("it should invite user", () => {
            let params = {
                id: id, 
                email: `7-${timestamp}@host.com`
            };
            return broker.call("groups.invite", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res[0].invited).toBeDefined();
                expect(res[0].invited).toEqual(getHash(`7-${timestamp}@host.com`));
            });
        });

        it("it should return invited member", () => {
            let params = {
                id: id
            };
            return broker.call("groups.invitations", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({ key: getHash(`7-${timestamp}@host.com`) }));
            });
        });
        
        it("it should hide invitation", () => {
            let opts = { meta: { user: { id: `7-${timestamp}`, email: `7-${timestamp}@host.com` } } };
            let params = {
                id: id, 
            };
            return broker.call("groups.hide", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res[0].hide).toBeDefined();
                expect(res[0].hide).toEqual(true);
            });
        });

        it("it should unhide invitation", () => {
            let opts = { meta: { user: { id: `7-${timestamp}`, email: `7-${timestamp}@host.com` } } };
            let params = {
                id: id, 
                unhide: true
            };
            return broker.call("groups.hide", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res[0].hide).toBeDefined();
                expect(res[0].hide).toEqual(false);
            });
        });

        it("it should refuse invitations", () => {
            let opts = { meta: { user: { id: `7-${timestamp}`, email: `7-${timestamp}@host.com` } } };
            let params = {
                id: id, 
            };
            return broker.call("groups.refuse", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res[0].id).toBeDefined();
                expect(res[0].id).toEqual(id);
            });
        });

        it("it should return invited member", () => {
            let params = {
                id: id
            };
            return broker.call("groups.invitations", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).not.toContainEqual(expect.objectContaining({ key: getHash(`7-${timestamp}@host.com`) }));
            });
        });
        
        it("it should change role in invitation", async () => {
            let params = {
                id: id, 
                email: `3-${timestamp}@host.com`,
                role: "admin"
            };
            return broker.call("groups.invite", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({ invited: getHash(`3-${timestamp}@host.com`), role: "admin" }));
            });
        });
        
        it("it should add user as member", () => {
            let opts = { meta: { user: { id: `3-${timestamp}`, email: `3-${timestamp}@host.com` } } };
            let params = {
                id: id
            };
            return broker.call("groups.join", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({ id: id, role: "admin" }));
            });
        });

        it("it should return all members", () => {
            let params = {
                id: id
            };
            return broker.call("groups.members", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({ id: `3-${timestamp}` }));
            });
        });
        
        it("it should throw error GroupsNotAuthenticated", async () => {
            opts = { meta: { user: { } } };
            let params = {
                id: id
            };
            expect.assertions(2);
            await broker.call("groups.members", params, opts).catch(err => {
                expect(err instanceof GroupsNotAuthenticated).toBe(true);
                expect(err.message).toEqual("not authenticated");
            });
        });        
        
        it("it should throw error GroupsNotAuthenticated", async () => {
            opts = { meta: { user: { } } };
            let params = {
                id: id, 
                email: `3-${timestamp}@host.com`
            };
            expect.assertions(2);
            await broker.call("groups.invite", params, opts).catch(err => {
                expect(err instanceof GroupsNotAuthenticated).toBe(true);
                expect(err.message).toEqual("not authenticated");
            });
        });        
        
        it("it should throw error GroupsNotAuthenticated", async () => {
            opts = { meta: { user: { } } };
            let params = {
                id: id
            };
            expect.assertions(2);
            await broker.call("groups.join", params, opts).catch(err => {
                expect(err instanceof GroupsNotAuthenticated).toBe(true);
                expect(err.message).toEqual("not authenticated");
            });
        });        
        
        it("it should return empty array (group does not exist)", async () => {
            let params = {
                id: id.replace(/...$/,"999"), 
                email: `3-${timestamp}@host.com`
            };
            return broker.call("groups.invite", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toEqual([]);
            });
        }); 

    });

    describe("Test list groups", () => {

        let opts;
        beforeEach(() => {

        });

        it("it should return groups with access by invited user", () => {
            opts = { meta: { user: { id: `3-${timestamp}`, email: `3-${timestamp}@host.com` } } };
            let params = {
                limit: 100
            };
            return broker.call("groups.list", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(Array.isArray(res)).toEqual(true);
                expect(res.length).toEqual(1);
                //res.forEach(element => console.log(element.members))
            });
        });

        it("it should return groups with access by admin", () => {
            opts = { meta: { user: { id: `1-${timestamp}`, email: `1-${timestamp}@host.com` } } };
            let params = {
                limit: 100
            };
            return broker.call("groups.list", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(Array.isArray(res)).toEqual(true);
                expect(res.length).toEqual(2);
                //res.forEach(element => console.log(element.members))
            });
        });

        it("it should return empty array (user does not belong to any group)", async () => {
            opts = { meta: { user: { id: "AnyId", email: "Any@host.com" } } };
            let params = {
                limit: 100
            };
            return broker.call("groups.list", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toEqual([]);
            });
        });

    });
    
    describe("Test join group as admin", () => {

        let opts, id;
        beforeEach(() => {
            opts = { meta: { user: { id: `1-${timestamp}`, email: `1-${timestamp}@host.com` } } };
        });

        it("it should return id for created entry", () => {
            let params = {
                name: "group to be joined as admin"
            };
            return broker.call("groups.add", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res[0]).toEqual(expect.objectContaining(params));
                id = res[0].id;
            });
        });

        it("it should invite user as admin", () => {
            let params = {
                id: id, 
                email: `4-${timestamp}@host.com`,
                role: "admin"
            };
            return broker.call("groups.invite", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res[0].invited).toBeDefined();
                expect(res[0].invited).toEqual(getHash(`4-${timestamp}@host.com`));
            });
        });
        
        it("it should add user as admin", () => {
            opts = { meta: { user: { id: `4-${timestamp}`, email: `4-${timestamp}@host.com` } } };
            let params = {
                id: id
            };
            return broker.call("groups.join", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({ id: id, role: "admin" }));
            });
        });

        it("it should return all members", () => {
            let params = {
                id: id
            };
            return broker.call("groups.members", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({ key: getHash(`4-${timestamp}@host.com`), id: `4-${timestamp}`, role: "admin" }));
            });
        });
        
        it("it should invite user as member", () => {
            let params = {
                id: id, 
                email: `5-${timestamp}@host.com`,
                role: "member"
            };
            return broker.call("groups.invite", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res[0].invited).toBeDefined();
                expect(res[0].invited).toEqual(getHash(`5-${timestamp}@host.com`));
            });
        });

        it("it should set alias", () => {
            opts = { meta: { user: { id: `5-${timestamp}`, email: `5-${timestamp}@host.com` } } };
            let params = {
                id: id, 
                alias: "alias #1"
            };
            return broker.call("groups.alias", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({ id: id, alias: "alias #1" }));
            });
        });

        it("it should return list with new alias", async () => {
            opts = { meta: { user: { id: `5-${timestamp}`, email: `5-${timestamp}@host.com` } } };
            let params = {
                limit: 100
            };
            return broker.call("groups.list", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({ id: id, alias: "alias #1" }));
            });
        });
        
        it("it should add user as member", () => {
            opts = { meta: { user: { id: `5-${timestamp}`, email: `5-${timestamp}@host.com` } } };
            let params = {
                id: id
            };
            return broker.call("groups.join", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({ id: id, role: "member" }));
            });
        });

        it("it should set new alias", () => {
            opts = { meta: { user: { id: `5-${timestamp}`, email: `5-${timestamp}@host.com` } } };
            let params = {
                id: id, 
                alias: "alias #2"
            };
            return broker.call("groups.alias", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({ id: id, alias: "alias #2" }));
            });
        });

        it("it should return list with new alias", async () => {
            opts = { meta: { user: { id: `5-${timestamp}`, email: `5-${timestamp}@host.com` } } };
            let params = {
                limit: 100
            };
            return broker.call("groups.list", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({ id: id, alias: "alias #2" }));
            });
        });
        
        it("it should change user role to contact", () => {
            opts = { meta: { user: { id: `4-${timestamp}`, email: `4-${timestamp}@host.com` } } };
            let params = {
                groupId: id, 
                userId: `5-${timestamp}`,
                role: "contact"
            };
            return broker.call("groups.setRole", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({ groupId: id, userId: `5-${timestamp}`, role: "contact" }));
            });
        });
        
        it("it should return all members", () => {
            let params = {
                id: id
            };
            return broker.call("groups.members", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({ id: `5-${timestamp}`, role: "contact" }));
            });
        });
        
        it("it should not change admins own role", async () => {
            opts = { meta: { user: { id: `1-${timestamp}`, email: `1-${timestamp}@host.com` } } };
            let params = {
                groupId: id, 
                userId: `1-${timestamp}`,
                role: "contact"
            };
            expect.assertions(3);
            await broker.call("groups.setRole", params, opts).catch(err => {
                expect(err instanceof GroupsUpdate).toBe(true);
                expect(err.message).toEqual("member cannot change his own role");
                expect(err.id).toEqual(id);
            });
        });
        
        it("it should not change other admins", async () => {
            opts = { meta: { user: { id: `1-${timestamp}`, email: `1-${timestamp}@host.com` } } };
            let params = {
                groupId: id, 
                userId: `4-${timestamp}`,
                role: "contact"
            };
            return broker.call("groups.setRole", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toEqual([]);
            });
        });
        
        it("it should return unchanged member", () => {
            let params = {
                id: id
            };
            return broker.call("groups.members", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({ id: `1-${timestamp}`, role: "admin" }));
            });
        });

        it("it should leave group", () => {
            opts = { meta: { user: { id: `4-${timestamp}`, email: `4-${timestamp}@host.com` } } };
            let params = {
                id: id
            };
            return broker.call("groups.leave", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({ id: id, role: "admin", key: getHash(`4-${timestamp}@host.com`) }));
            });
        });

        it("it should return member as invited" , () => {
            let params = {
                id: id
            };
            return broker.call("groups.members", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({ key: getHash(`4-${timestamp}@host.com`), id: `4-${timestamp}`, role: "admin", relation: "INVITED_BY", email: `4-${timestamp}@host.com` }));
            });
        });
        
        it("it should remove invited member from group", () => {
            let params = {
                groupId: id,
                userId: `4-${timestamp}`
            };
            return broker.call("groups.remove", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({ key: getHash(`4-${timestamp}@host.com`), groupId: id }));
            });
        });

        it("it should return all members w/o removed invitation", () => {
            let params = {
                id: id
            };
            return broker.call("groups.members", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).not.toContainEqual(expect.objectContaining({ key: getHash(`4-${timestamp}@host.com`) }));
            });
        });
        
        it("it should remove member from group", () => {
            let params = {
                groupId: id,
                userId: `5-${timestamp}`
            };
            return broker.call("groups.remove", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({ userId: `5-${timestamp}`, groupId: id }));
            });
        });

        it("it should return all members", () => {
            let params = {
                id: id
            };
            return broker.call("groups.members", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).not.toContainEqual(expect.objectContaining({ id: `5-${timestamp}` }));
            });
        });
        
        it("it should throw error GroupsNotAuthenticated", async () => {
            opts = { meta: { user: { } } };
            let params = {
                groupId: id, 
                userId: `1-${timestamp}`,
                role: "contact"
            };
            expect.assertions(2);
            await broker.call("groups.setRole", params, opts).catch(err => {
                expect(err instanceof GroupsNotAuthenticated).toBe(true);
                expect(err.message).toEqual("not authenticated");
            });
        });        
        
        
        it("it should return empty array (group does not exist)", async () => {
            opts = { meta: { user: { id: `4-${timestamp}`, email: `4-${timestamp}@host.com` } } };
            let params = {
                id: id.replace(/...$/,"999")
            };
            return broker.call("groups.leave", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toEqual([]);
            });
        });        

    });
    
    describe("Test ttl", () => {

        let opts, id;
        beforeEach(() => {
            opts = { meta: { user: { id: `1-${timestamp}`, email: `1-${timestamp}@host.com` } } };
        });

        it("it should return id for created entry", () => {
            let params = {
                name: "group for ttl test"
            };
            return broker.call("groups.add", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res[0]).toEqual(expect.objectContaining(params));
                id = res[0].id;
            });
        });

        it("it should leave group and set ttl", () => {
            let params = {
                id: id
            };
            let tteLow = Date.now() + ( 1000 * 60 * 60 * 24 * 13 );  // add 13 days
            let tteHigh = Date.now() + ( 1000 * 60 * 60 * 24 * 15 );  // add 15 days
            return broker.call("groups.leave", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({ id: id, role: "admin", key: getHash(`1-${timestamp}@host.com`) }));
                expect(res[0].ttl).toBeDefined();
                expect(res[0].ttl > tteLow && res[0].ttl < tteHigh ).toEqual(true);
            });
        });
      
        it("it should return group with ttl", () => {
            let params = {
                id: id
            };
            return broker.call("groups.get", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({ id: id }));
                expect(res[0].ttl).toBeDefined();
            });
        });

        it("it should join as admin and delete ttl again", () => {
            let params = {
                id: id
            };
            return broker.call("groups.join", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({ id: id, role: "admin" }));
            });
        });

        it("it should return group with cleared ttl", () => {
            let params = {
                id: id
            };
            return broker.call("groups.get", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({ id: id }));
                expect(res[0].ttl).toEqual(null);
            });
        });
      
    });

    describe("Test nominate and revoke", () => {

        let opts, group;
        beforeEach(() => {
            opts = { meta: { user: { id: `1-${timestamp}`, email: `1-${timestamp}@host.com` } } };
        });

        it("it should return id for group", () => {
            let params = {
                name: "Test group"
            };
            return broker.call("groups.add", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining(params));
                group = res[0].id;
            });
        });
        
        for (let t = 2; t < 5; t++ ) {
            it(`it should invite ${t}. user`, () => {
                let params = {
                    id: group, 
                    email: `t${t}-${timestamp}@host.com`
                };
                return broker.call("groups.invite", params, opts).then(res => {
                    expect(res).toBeDefined();
                    expect(res[0].invited).toBeDefined();
                    expect(res[0].invited).toEqual(getHash(`t${t}-${timestamp}@host.com`));
                });
            });

            it(`it should add ${t}. user as member`, () => {
                opts = { meta: { user: { id: `t${t}-${timestamp}`, email: `t${t}-${timestamp}@host.com` } } };
                let params = {
                    id: group
                };
                return broker.call("groups.join", params, opts).then(res => {
                    expect(res).toBeDefined();
                    expect(res).toContainEqual(expect.objectContaining({ id: group, role: "member" }));
                });
            });
        }
        
        it("it should nominate second user as admin", () => {
            let params = {
                groupId: group,
                userId: `t2-${timestamp}`
            };
            return broker.call("groups.nominate", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({request: "nominate", requester: opts.meta.user.id }));
            });
        });
    
        it("it should accept second user as admin", () => {
            opts.meta.user = { id: `t2-${timestamp}`, email: `2-${timestamp}@host.com` };
            let params = {
                groupId: group,
                request: "nominate"
            };
            return broker.call("groups.accept", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({role: "admin", request: null, requester: null }));
            });
        });
    
        it("it should nominate third user as admin", () => {
            let params = {
                groupId: group,
                userId: `t3-${timestamp}`
            };
            return broker.call("groups.nominate", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({request: "nominate", requester: opts.meta.user.id }));
            });
        });
    
        it("it should decline third user as admin", () => {
            opts.meta.user = { id: `t3-${timestamp}`, email: `3-${timestamp}@host.com` };
            let params = {
                groupId: group,
                request: "nominate"
            };
            return broker.call("groups.decline", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({role: "member", request: null, requester: null }));
            });
        });
    
        it("it should request to revoke second user as admin", () => {
            let params = {
                groupId: group,
                userId: `t2-${timestamp}`
            };
            return broker.call("groups.revoke", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({request: "revoke", requester: opts.meta.user.id }));
                expect(res[0].tte).toBeDefined();
            });
        });

        it("it should accept revoke request by second user", () => {
            opts.meta.user = { id: `t2-${timestamp}`, email: `2-${timestamp}@host.com` };
            let params = {
                groupId: group,
                request: "revoke"
            };
            return broker.call("groups.accept", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({role: "member", request: null, requester: null, tte: null }));
            });
        });

        it("it should nominate third user as admin", () => {
            let params = {
                groupId: group,
                userId: `t3-${timestamp}`
            };
            return broker.call("groups.nominate", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({request: "nominate", requester: opts.meta.user.id }));
            });
        });
    
        it("it should accept third user as admin", () => {
            opts.meta.user = { id: `t3-${timestamp}`, email: `3-${timestamp}@host.com` };
            let params = {
                groupId: group,
                request: "nominate"
            };
            return broker.call("groups.accept", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({role: "admin", request: null, requester: null }));
            });
        });
    
      
        it("it should request to revoke third user as admin again", () => {
            let params = {
                groupId: group,
                userId: `t3-${timestamp}`
            };
            return broker.call("groups.revoke", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({request: "revoke", requester: opts.meta.user.id }));
                expect(res[0].tte).toBeDefined();
            });
        });

        it("it should decline revoke request by third user", () => {
            opts.meta.user = { id: `t3-${timestamp}`, email: `3-${timestamp}@host.com` };
            let params = {
                groupId: group,
                request: "revoke"
            };
            return broker.call("groups.decline", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContainEqual(expect.objectContaining({role: "admin", request: null, requester: null, tte: null }));
            });
        });
        
    });

    describe("Test stop broker", () => {
        it("should stop the broker", async () => {
            expect.assertions(1);
            await broker.stop();
            expect(broker).toBeDefined();
        });
    });    	
    
});