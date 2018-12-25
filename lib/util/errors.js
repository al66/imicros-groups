/**
 * @license MIT, imicros.de (c) 2018 Andreas Leinen
 */
"use strict";

class GroupsError extends Error {
    constructor(e) {
        super(e);
        Error.captureStackTrace(this, this.constructor);
        this.message = e.message || e;
        this.name = this.constructor.name;
    }
}

class GroupsNotAuthenticated extends GroupsError {}

class GroupsUpdate extends GroupsError {
    constructor(e, { id, err } = {}) {
        super(e);
        this.id = id;
        this.err = err;
    }
}

module.exports = {
    GroupsError,
    GroupsNotAuthenticated,
    GroupsUpdate
};