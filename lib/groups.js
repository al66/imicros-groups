/**
 * @license MIT, imicros.de (c) 2018 Andreas Leinen
 */
"use strict";

const dbMixin       = require("./db.neo4j");
const { GroupsNotAuthenticated,
        GroupsUpdate
} = require("./util/errors");
const { v4: uuid } = require("uuid");
const _ = require("lodash");

/** Actions */
// action add { name } => { id (group), name (group), userId, role }
// action invite { id, email, role } => { id (group), name (group), invited, role } only for group admins
// action refuse { id } => { result }
// action hide { id, unhide } => { result }
// action setRole { groupId, userId, role } => { result } only for group admins
// action remove { id, email } => { result } only for group admins
// action join { id } => { result } 
// action leave { id } => { result }
// action alias { id, alias } => { result }
// action list { } => { groups }
// action get { id } => { group }
// action members { id } => { members }
// action invitations { id } => { invited users }
// action rename { id, name } => { group } only for group admins

//TODO: ?? action delete { id } => { result } only for admins

module.exports = {
    name: "groups",
    mixins: [dbMixin],
    
    /**
     * Service settings
     */
    settings: {
        /*
        adminRole : "admin",
        defaultRole : "member",
        defaultPolicy: {
            delete: 1,          // 100% must vote for deleting a group
            nominate: 0.5,      // 50%  must vote for assign admin role to a member
            revoke: 0.5,        // 50%  must vote for degrade a admin to a normal member
            update: 0.5         // 50%  must vote to update the group policy
        },
        initial : [{
            name: "imciros administration",
            member: "admin@imicros.de",
            core: true
        }]
        */
    },

    /**
     * Service metadata
     */
    metadata: {},

    /**
     * Service dependencies
     */
    //dependencies: [],	

    /**
     * Actions
     */
    actions: {

        /**
         * Create a new group
         * 
         * @actions
         * @param {String} name
         * 
         * @returns {Object} Created group with id
         */
        add: {
            params: {
                name: "string"
            },
            handler(ctx) {
                let user = this.isAuthenticated (ctx.meta);
                let params = {
                    groupId: uuid(),
                    name: ctx.params.name,
                    userId: user.id,
                    email: user.email,
                    role: this.roles.admin
                };
                let statement = "CREATE (g:Group { uid: {groupId}, name: {name} })";
                statement += "MERGE (u:User { email: {email} }) ";
                statement += "SET u.uid = {userId} ";
                statement += "MERGE (u)-[r:MEMBER_OF { role: {role} }]->(g)";
                statement += "RETURN g.uid AS id, g.name AS name, u.uid AS userId, r.role AS role;";
                let result = this.run(statement, params);
                if (result.length > 0) this.broker.emit("groups.group.created",{ userId: user.id, groupId: params.groupId });
                return result;
            }
        },
        
        /**
         * Get group by id
         * 
         * @actions
         * @param {String}  id
         * 
         * @returns {Object} group
         */
        get: {
            params: {
                id: { type: "string" }
            },
            handler(ctx) {
                let user = this.isAuthenticated (ctx.meta);
                let params = {
                    groupId: ctx.params.id,
                    userId: user.id,
                    email: user.email
                };
                let statement = "MATCH (u:User)-[r:MEMBER_OF|INVITED_BY]->(g:Group { uid: {groupId} }) ";
                statement += "WHERE u.uid = {userId} OR u.email = {email} ";
                statement += "RETURN g.uid AS id, g.name AS name, g.ttl AS ttl, TYPE(r) AS relation, r.role AS role";
                statement += ";";
                return this.run(statement, params);
            }
        },
        
        /**
         * List all groups, where user is member
         * 
         * @actions
         * @param {Number} limit
         * @param {Number} offset
         * 
         * @returns {Object} array of groups
         */
        list: {
            params: {
                limit: { type: "number", optional: true },
                offset: { type: "number", optional: true }
            },
            handler(ctx) {
                let user = this.isAuthenticated (ctx.meta);
                let params = {
                    userId: user.id,
                    email: user.email,
                    offset: ctx.params.offset || 0, 
                    limit: ctx.params.limit || 1000
                };
                let statement = "MATCH (u:User)-[r:MEMBER_OF|INVITED_BY]->(g:Group) ";
                statement += "WHERE u.uid = {userId} OR u.email = {email} ";
                statement += "RETURN g.uid AS id, g.name AS name, g.core AS core, g.ttl AS ttl, ";
                statement += "TYPE(r) AS relation, r.role AS role, r.alias AS alias, r.hide AS hide, ";
                statement += "r.request AS request, r.requester AS requester, r.tte AS tte ";
                statement += "ORDER BY g.uid ";
                statement += "SKIP {offset} LIMIT {limit}";
                statement += ";";
                return this.run(statement, params);
            }
        },
        
        /**
         * Rename group
         * 
         * @actions
         * @param {String} id
         * @param {String} new name
         * 
         * @returns {Object} result
         */
        rename: {
            params: {
                id: { type: "string" },
                name: { type: "string" }
            },
            handler(ctx) {
                let user = this.isAuthenticated (ctx.meta);
                let params = {
                    groupId: ctx.params.id,
                    newName: ctx.params.name,
                    userId: user.id,
                    role: this.roles.admin
                };
                let statement = "MATCH (u:User { uid: {userId} })-[r:MEMBER_OF { role: {role} }]->(g:Group { uid: {groupId} }) ";
                statement += "SET g.name = {newName}";
                statement += "RETURN g.uid AS id, g.name AS name";
                statement += ";";
                return this.run(statement, params);
            }
        },
        
        /**
         * Invite user to a group
         * 
         * @actions
         * @param {String} group id
         * @param {String} email (invited user)
         * @param {String} role ( admin | member | contact )
         * 
         * @returns {Object} result
         */
        invite: {
            params: {
                id: { type: "string" },
                email: "email",
                role: { type: "string" , optional: true}
            },
            handler(ctx) {
                let user = this.isAuthenticated (ctx.meta);
                let params = {
                    groupId: ctx.params.id,
                    invite: ctx.params.email,
                    inviteWithRole: ctx.params.role ||  this.roles.default,
                    userId: user.id,
                    role: this.roles.admin
                };
                let statement = "MATCH (:User { uid: {userId} })-[r:MEMBER_OF { role: {role} }]->(g:Group { uid: {groupId} }) ";
                statement += "MERGE (u:User { email: {invite} }) ";
                statement += "MERGE (u)-[i:INVITED_BY]-(g) ";
                statement += "ON CREATE SET i.role = {inviteWithRole} ";
                statement += "ON MATCH SET i.role = {inviteWithRole} ";
                statement += "RETURN g.uid AS id, g.name AS name, u.email AS invited, i.role AS role";
                statement += ";";
                let result = this.run(statement, params);
                if (result.length > 0) this.broker.emit("groups.user.invited",{ email: params.email, groupId: params.groupId });
                return result;
            }
        },

        /**
         * Refuse invitation to a group
         * 
         * @actions
         * @param {String} group id
         * 
         * @returns {Object} result
         */
        refuse: {
            params: {
                id: { type: "string" }
            },
            handler(ctx) {
                let user = this.isAuthenticated (ctx.meta);
                let params = {
                    groupId: ctx.params.id,
                    email: user.email,
                };
                let statement = "MATCH (u:User { email: {email} })-[r:INVITED_BY]->(g:Group { uid: {groupId} }) ";
                statement += "DELETE r ";
                statement += "RETURN g.uid AS id, g.name AS name";
                statement += ";";
                return this.run(statement, params);
            }
        },

        /**
         * Set hide flag for group
         * 
         * @actions
         * @param {String}  group id
         * @param {Boolean} hide
         * 
         * @returns {Object} result
         */
        hide: {
            params: {
                id: { type: "string" },
                unhide: { type: "boolean", optional: true }
            },
            handler(ctx) {
                let user = this.isAuthenticated (ctx.meta);
                let params = {
                    groupId: ctx.params.id,
                    email: user.email,
                    hide: ctx.params.unhide ? false : true
                };
                let statement = "MATCH (u:User { email: {email} })-[r:INVITED_BY|MEMBER_OF]->(g:Group { uid: {groupId} }) ";
                statement += "SET r.hide = {hide} ";
                statement += "RETURN g.uid AS id, g.name AS name, r.hide AS hide";
                statement += ";";
                return this.run(statement, params);                
            }
        },

        /**
         * Nominate user for admin role
         * 
         * @actions
         * @param {String}          group id
         * @param {String | Number} user id
         * 
         * @returns {Object} result
         */
        nominate: {
            params: {
                groupId: { type: "string" },
                userId: [
                    { type: "string" },
                    { type: "number" }
                ]
            },
            handler(ctx) {
                let user = this.isAuthenticated (ctx.meta);
                let params = {
                    groupId: ctx.params.groupId,
                    userId: ctx.params.userId,
                    adminId: user.id,  
                    adminRole: this.roles.admin
                };
                let statement = "MATCH (u:User { uid: {userId} })-[r:MEMBER_OF]->(g:Group { uid: {groupId} }) ";
                statement += "WHERE r.role <> {adminRole} AND (g)<-[:MEMBER_OF { role: {adminRole} }]-(:User  { uid: {adminId} })";
                statement += "SET r.request = 'nominate', r.requester = {adminId} ";
                statement += "RETURN u.uid AS userId, u.email AS email, g.uid AS groupId, r.request AS request, r.requester AS requester";
                statement += ";";
                return this.run(statement, params);
            }
        },
        
        /**
         * Revoke admin role - change role to member
         * 
         * @actions
         * @param {String}          group id
         * @param {String | Number} user id
         * 
         * @returns {Object} result
         */
        revoke: {
            params: {
                groupId: { type: "string" },
                userId: [
                    { type: "string" },
                    { type: "number" }
                ]
            },
            handler(ctx) {
                let user = this.isAuthenticated (ctx.meta);
                let tte = Date.now() + ( 1000 * 60 * 60 * 24 * 14 );  // add 14 days
                let params = {
                    groupId: ctx.params.groupId,
                    userId: ctx.params.userId,
                    adminId: user.id,  
                    tte: tte,
                    adminRole: this.roles.admin
                };
                let statement = "MATCH (u:User {uid: {userId}})-[r:MEMBER_OF { role: {adminRole} }]->(g:Group { uid: {groupId} }) ";
                statement += "WHERE u.uid <> {adminId} AND (g)<-[:MEMBER_OF { role: {adminRole} }]-(:User  { uid: {adminId} })";
                statement += "SET r.request = 'revoke', r.tte = {tte}, r.requester = {adminId} ";
                statement += "RETURN u.uid AS userId, u.email AS email, g.uid AS groupId, r.request AS request, r.requester AS requester, r.tte AS tte";
                statement += ";";
                return this.run(statement, params);
            }
        },        
        
        /**
         * Accept a command
         * 
         * @actions
         * @param {String}          group id
         * @param {String}          request
         * 
         * @returns {Object} result
         */
        accept: {
            params: {
                groupId: { type: "string" },
                request: { type: "string" }
            },
            handler(ctx) {
                let user = this.isAuthenticated (ctx.meta);
                let params = {
                    groupId: ctx.params.groupId,
                    userId: user.id,
                    defaultRole: this.roles.default
                };
                let statement = "";
                switch (ctx.params.request) {
                    case "nominate":
                        statement = "MATCH (u:User { uid: {userId} })-[r:MEMBER_OF { request: 'nominate' }]->(g:Group { uid: {groupId} }) ";
                        statement += "SET r.role = 'admin', r.request = null, r.requester = null, r.tte = null ";
                        statement += "RETURN u.uid AS userId, u.email AS email, g.uid AS groupId, r.role AS role, r.request AS request, r.requester AS requester, r.tte AS tte";
                        statement += ";";
                        break;
                    case "revoke":
                        statement = "MATCH (u:User { uid: {userId} })-[r:MEMBER_OF { request: 'revoke' }]->(g:Group { uid: {groupId} }) ";
                        statement += "SET r.role = {defaultRole}, r.request = null, r.requester = null, r.tte = null ";
                        statement += "RETURN u.uid AS userId, u.email AS email, g.uid AS groupId, r.role AS role, r.request AS request, r.requester AS requester, r.tte AS tte";
                        statement += ";";
                        break;
                }
                return this.run(statement, params);
            }
        },
        
        /**
         * Decline a command
         * 
         * @actions
         * @param {String}          group id
         * @param {String}          request
         * 
         * @returns {Object} result
         */
        decline: {
            params: {
                groupId: { type: "string" },
                request: { type: "string" }
            },
            handler(ctx) {
                let user = this.isAuthenticated (ctx.meta);
                let params = {
                    groupId: ctx.params.groupId,
                    userId: user.id,
                    defaultRole: this.roles.default
                };
                let statement = "";
                switch (ctx.params.request) {
                    case "nominate":
                        statement = "MATCH (u:User { uid: {userId} })-[r:MEMBER_OF { request: 'nominate' }]->(g:Group { uid: {groupId} }) ";
                        statement += "SET r.request = null, r.requester = null, r.tte = null ";
                        statement += "RETURN u.uid AS userId, u.email AS email, g.uid AS groupId, r.role AS role, r.request AS request, r.requester AS requester, r.tte AS tte";
                        statement += ";";
                        break;
                    case "revoke":
                        statement = "MATCH (u:User { uid: {userId} })-[r:MEMBER_OF { request: 'revoke' }]->(g:Group { uid: {groupId} }) ";
                        statement += "SET r.request = null, r.requester = null, r.tte = null ";
                        statement += "RETURN u.uid AS userId, u.email AS email, g.uid AS groupId, r.role AS role, r.request AS request, r.requester AS requester, r.tte AS tte";
                        statement += ";";
                        break;
                }
                return this.run(statement, params);
            }
        },
        
        /**
         * Remove user from group
         * 
         * @actions
         * @param {String}          group id
         * @param {String | Number} user id 
         * @param {String}          email 
         * 
         * @returns {Object} result
         */
        remove: {
            params: {
                groupId: { type: "string" },
                userId: [
                    { type: "string", optional: true },
                    { type: "number", optional: true }
                ],
                email: { type: "email", optional: true }
            },
            handler(ctx) {
                let user = this.isAuthenticated (ctx.meta);
                if (!ctx.params.userId && !ctx.params.email) return [];
                if (ctx.params.userId) {
                    let params = {
                        groupId: ctx.params.groupId,
                        userId: ctx.params.userId,
                        adminId: user.id,  
                        adminRole: this.roles.admin
                    };
                    let statement = "MATCH (u:User { uid: {userId} })-[r:MEMBER_OF|INVITED_BY]->(g:Group { uid: {groupId} }) ";
                    statement += "WHERE ( TYPE(r) <> 'MEMBER_OF' OR r.role <> {adminRole} ) AND (g)<-[:MEMBER_OF { role: {adminRole} }]-(:User  { uid: {adminId} })";
                    statement += "DELETE r ";
                    statement += "RETURN u.uid AS userId, u.email AS email, g.uid AS groupId";
                    statement += ";";
                    return this.run(statement, params);
                } else {
                    let params = {
                        groupId: ctx.params.groupId,
                        email: ctx.params.email,
                        adminId: user.id,  
                        adminRole: this.roles.admin
                    };
                    let statement = "MATCH (u:User { email: {email} })-[r:MEMBER_OF|INVITED_BY]->(g:Group { uid: {groupId} }) ";
                    statement += "WHERE ( TYPE(r) <> 'MEMBER_OF' OR r.role <> {adminRole} ) AND (g)<-[:MEMBER_OF { role: {adminRole} }]-(:User  { uid: {adminId} })";
                    statement += "DELETE r ";
                    statement += "RETURN u.uid AS userId, u.email AS email, g.uid AS groupId";
                    statement += ";";
                    return this.run(statement, params);
                }
            }
        },

        /**
         * Change role of group member
         * 
         * @actions
         * @param {String}          group id
         * @param {String | Number} user id
         * @param {String}          role ( admin | member | contact )
         * 
         * @returns {Object} result
         */
        setRole: {
            params: {
                groupId: { type: "string" },
                userId: [
                    { type: "string" },
                    { type: "number" }
                ],
                role: { type: "string" }
            },
            handler(ctx) {
                let user = this.isAuthenticated (ctx.meta);
                if (ctx.params.userId == user.id) {
                    throw new GroupsUpdate("member cannot change his own role", { id: ctx.params.groupId } );
                } 
                let params = {
                    groupId: ctx.params.groupId,
                    userId: ctx.params.userId,
                    adminId: user.id,  
                    adminRole: this.roles.admin,
                    newRole: ctx.params.role
                };
                let statement = "MATCH (u:User { uid: {userId} })-[r:MEMBER_OF]->(g:Group { uid: {groupId} }) ";
                statement += "WHERE r.role <> {adminRole} AND (g)<-[:MEMBER_OF { role: {adminRole} }]-(:User  { uid: {adminId} })";
                statement += "SET r.role = {newRole}";
                statement += "RETURN u.uid AS userId, g.uid AS groupId, r.role AS role";
                statement += ";";
                return this.run(statement, params);
            }
        },
        
        /**
         * Get list of group members
         * 
         * @actions
         * @param {String} group id
         * 
         * @returns {Object} result
         */
        members: {
            params: {
                id: { type: "string" },
            },
            handler(ctx) {
                let user = this.isAuthenticated (ctx.meta);
                let params = {
                    groupId: ctx.params.id,
                    userId: user.id,
                    role: this.roles.admin
                };
                let statement = "MATCH (u:User)-[r:MEMBER_OF|INVITED_BY]->(g:Group { uid: {groupId} }) ";
                statement += "WHERE (g)<-[:MEMBER_OF|INVITED_BY]-(:User  { uid: {userId} })";
                statement += "RETURN u.email AS email, u.uid AS id, r.role AS role, TYPE(r) AS relation, ";
                statement += "r.request AS request, r.requester AS requester, r.tte AS tte LIMIT 1000";
                return this.run(statement, params);
            }
        },
        
        /**
         * Get list of group invitation
         * 
         * @actions
         * @param {String} group id
         * 
         * @returns {Object} result
         */
        invitations: {
            params: {
                id: { type: "string" },
            },
            handler(ctx) {
                let user = this.isAuthenticated (ctx.meta);
                let params = {
                    groupId: ctx.params.id,
                    userId: user.id,
                    role: this.roles.admin
                };
                let statement = "MATCH (u:User)-[r:INVITED_BY]->(g:Group { uid: {groupId} }) ";
                statement += "WHERE (g)<-[:MEMBER_OF]-(:User  { uid: {userId} })";
                statement += "RETURN u.email AS email, r.role AS role LIMIT 1000";
                return this.run(statement, params);
            }
        },
        
        /**
         * Accept invitation to a group
         * 
         * @actions
         * @param {String} group id
         * 
         * @returns {Object} result
         */
        join: {
            params: {
                id: { type: "string" },
            },
            handler(ctx) {
                let user = this.isAuthenticated (ctx.meta);
                let params = {
                    groupId: ctx.params.id,
                    userId: user.id,
                    email: user.email,  
                    adminRole: this.roles.admin
                };
                let statement = "MERGE (u:User { email: {email}})";
                statement += "SET u.uid = {userId} ";
                statement += "WITH u ";
                statement += "MATCH (:User { email: {email} })-[i:INVITED_BY]->(g:Group { uid: {groupId} })";
                statement += "CREATE (u)-[r:MEMBER_OF]->(g) ";
                statement += "SET r = i ";
                statement += "WITH u, i, g, r ";
                statement += "DELETE i ";
                statement += "WITH u, g, r ";
                statement += "SET (CASE WHEN r.role = {adminRole} THEN g END ).ttl = null ";
                statement += "RETURN g.uid AS id, r.role AS role ";
                return this.run(statement, params);
            }
        },
        
        /**
         * Set alias name for group
         * 
         * @actions
         * @param {String} group id
         * @param {String} alias name
         * 
         * @returns {Object} result
         */
        alias: {
            params: {
                id: { type: "string" },
                alias: { type: "string", optional: true }
            },
            handler(ctx) {
                let user = this.isAuthenticated (ctx.meta);
                let params = {
                    groupId: ctx.params.id,
                    userId: user.id,
                    email: user.email,
                    alias: ctx.params.alias || ""
                };
                let statement = "MATCH (u:User)-[r:MEMBER_OF|INVITED_BY]->(g:Group { uid: {groupId} }) ";
                statement += "WHERE u.uid = {userId} OR u.email = {email} "; 
                statement += "SET r.alias = {alias} ";
                statement += "RETURN g.uid AS id, g.name AS name, r.alias AS alias";
                statement += ";";
                return this.run(statement, params);
            }
        },
        
        /**
         * Leave a group
         * 
         * @actions
         * @param {String} group id
         * 
         * @returns {Object} result
         */
        leave: {
            params: {
                id: { type: "string" },
            },
            handler(ctx) {
                let user = this.isAuthenticated (ctx.meta);
                let ttl = Date.now() + ( 1000 * 60 * 60 * 24 * 14 );  // add 14 days
                let params = {
                    groupId: ctx.params.id,
                    userId: user.id,
                    email: user.email,
                    adminRole: this.roles.admin,
                    ttl: ttl 
                };
                let statement = "MATCH (u:User { uid: {userId} })-[r:MEMBER_OF]->(g:Group { uid: {groupId} }) ";
                statement += "MERGE (t:User { email: {email} }) ";
                statement += "MERGE (t)-[i:INVITED_BY]->(g) ";
                statement += "SET i = r ";
                statement += "WITH u, t, i, g, r ";
                statement += "DELETE r ";
                statement += "WITH u, t, g, i ";
                statement += "OPTIONAL MATCH (g)<-[r:MEMBER_OF { role: {adminRole} }]-() ";
                statement += "WITH u, t, g, i, count(r) as admins ";
                statement += "SET (CASE WHEN admins < 1 THEN g END ).ttl = {ttl} ";
                statement += "RETURN g.uid AS id, g.ttl AS ttl, i.role AS role, t.email AS email ";
                return this.run(statement, params);
            }
        },
        
        /**
         * Add a new Ressource
         *
         * @actions
         * @param {String|Number}   resId - unique ID der Ressource
         * @param {String}          groupId - owner group ID
         * @param {String}          service - name of the service which serves the ressource
         * @param {String}          getAction - name of the action to be called with the resId to retrieve the object
         * 
         * @returns {Object}        resId
         */
        addRessource: {
            params: {
                resId: [
                    { type: "string", optional: true },
                    { type: "number", optional: true }
                ],
                groupId: { type: "string" },
                service: { type: "string" },
                getAction: { type: "string", optional: true }
            },
            handler(ctx) {
                let user = this.isAuthenticated (ctx.meta);
                let params = {
                    resId: ctx.params.resId || uuid(),
                    groupId: ctx.params.groupId,
                    service: ctx.params.service,
                    get: ctx.params.getAction,
                    userId: user.id,
                };
                let statement = "MATCH (g:Group {uid: {groupId}})<-[:MEMBER_OF]-(u:User {uid: {userId} }) ";
                statement += "MERGE (s:Service { name: {service} }) ";
                statement += "MERGE (r:Ressource { uid: {resId} }) ";
                statement += "MERGE (r)-[:OWNER]->(g) ";
                statement += "MERGE (r)-[i:STORE]->(s) ";
                statement += "SET i.get = {get} ";
                statement += "RETURN r.uid AS resId, g.uid AS groupId, s.name AS service;";
                return this.run(statement, params);
            }
        },
        
    },
    
    /**
     * Events
     */
    events: {},

    /**
     * Methods
     */
    methods: {
        
        /**
         * Check User
         * 
         * @param {Object} meta data of call 
         * 
         * @returns {Object} user entity
         */
        isAuthenticated (meta) {
            let user = {
                id: _.get(meta,"user.id",null),
                email: _.get(meta,"user.email",null)
            };
            if (!user || !user.id || !user.email ) {
                throw new GroupsNotAuthenticated("not authenticated" );
            }
            return user;
        },
        
        /**
         * Setup initial groups according to settings
         * 
         * @param {Array} groups to create 
         * 
         */
        async initialGroups (groups) {
            if (!Array.isArray(groups)) return;
            let params = {
                groups: []
            };
            
            for (let i=0; i< groups.length; i++) {
                if (groups[i].name && groups[i].member) {
                    params.groups.push({
                        groupId: uuid(),
                        name: groups[i].name,
                        email: groups[i].member,
                        core: groups[i].core || false,
                        role: this.roles.admin
                    });
                }
            }
            this.logger.info("Initial groups to be created", params,groups);
                
            let statement = "UNWIND {groups} as e ";
            statement += "MERGE (g:Group { name: e.name, core: e.core })";
            statement += "ON CREATE SET g.uid = e.groupId ";
            statement += "MERGE (u:User { email: e.email }) ";
            statement += "MERGE (u)-[r:INVITED_BY { role: e.role }]-(g)";
            statement += "RETURN g.uid AS id, g.name AS name, g.core AS core, u.email AS email, u.uid AS userId, r.role AS role;";
            try {
                let result = await this.run(statement, params);
                this.logger.info("Initial groups created", result);
                // emit events
                for (let i=0; i< result.length; i++) {
                    this.broker.emit("groups.user.joined",{ userId: result[i].userId, groupId: result[i].groupId, core: result[i].core });
                }
            } catch (err) {
                this.logger.warn("Failed to create initial groups", err);
            }
            
        }
        
    },

    /**
     * Service created lifecycle event handler
     */
    created() {
        this.roles = {
            admin : this.settings.adminRole || "admin",
            default : this.settings.defaultRole || "member",
        };
    },

    /**
     * Service started lifecycle event handler
     */
    async started() {
        let groups = _.get(this.settings,"initial",null);
        await this.initialGroups(groups);
    },

    /**
     * Service stopped lifecycle event handler
     */
    stopped() {}
    
};