/**
 * @license MIT, imicros.de (c) 2018 Andreas Leinen
 */
"use strict";

const { GroupsNotAuthorized,
        GroupsUpdate
} = require("./util/errors");

module.exports = {

    /**
     * Service settings
     */
    settings: {
        /*
        groupsService: "groups";
        getAction: "get";
        */
    },
    
    /**
     * Methods
     */
    methods: {
        
        /**
         * Check Authorization
         * 
         * @param {String|Number}   resId - unique ID der Ressource
         * @param {String}          action - name of the called action or a specific command like read,write,update
         * 
         * @returns {Booelan}       true
         */
        async isAuthorized (params) {
            params.service = this.name;
            let res =  await this.broker.call(`${this.groupsService}.isAuthorized`,params);
            if (Array.isArray(res)) {
                let grant;
                res.forEach(record => {
                    if (record.owner) grant = record;   // owner always highest
                    if (!grant) grant = record;
                })
                if (grant) return true;
            };
            throw new GroupsNotAuthorized("not authorized", params);
        },
        
        /**
         * Register a new ressource
         * 
         * @param {String|Number}   resId - unique ID der Ressource
         * @param {String}          getAction - name of the action to be called with the resId to retrieve the object
         * 
         * @returns {String}        resId
         */
        async registerRessource (params) {
            params.service = this.name;                                 // this name is used to merge service node in database
            params.getAction = params.getAction || this.getAction;      // use default settings, if not delivered
            let res =  await this.broker.call(`${this.groupsService}.addRessource`,params);
            if (!res || !res[0].id) {
                throw new GroupsUpdate("ressource could not get registered", { id: params.resId });
            };
            return res[0].id;
        }
        
    },

    /**
     * Service created lifecycle event handler
     */
    created() {
        this.groupsService = this.settings.groupsService || "groups";
        this.getAction = this.settings.getAction;
    }

};
        