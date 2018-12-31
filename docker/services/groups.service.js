"use strict";

const { Groups } = require("imicros-groups");

module.exports = {
    name: "groups",
    mixins: [Groups],
    
	/**
	 * Service settings
	 */
    settings: {
        uri: "bolt://neo4j_groups:7687",
        user: "neo4j",
        password: "neo4j"
    },


	/**
	 * Service created lifecycle event handler
	 */
    created() {},

	/**
	 * Service started lifecycle event handler
	 */
    started() {},

	/**
	 * Service stopped lifecycle event handler
	 */
    stopped() {}
};