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
    /* istanbul ignore else */
    constructor(e, { id, err } = {}) {
        super(e);
        this.id = id;
        this.err = err;
    }
}

class GroupsNotAuthorized extends GroupsError {
    /* istanbul ignore else */
    constructor(e, { userId, resId, action } = {}) {
        super(e);
        this.userId = userId;
        this.resId = resId;
        this.action = action;
    }
}

module.exports = {
    GroupsError,
    GroupsNotAuthenticated,
    GroupsUpdate,
    GroupsNotAuthorized
};