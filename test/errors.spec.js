"use strict";

const { GroupsError,
        GroupsNotAuthenticated,
        GroupsUpdate,
        GroupsNotAuthorized } = require("../index").Errors;

describe("Test errors without parameter", () => {
   
    it("it should create error without parameters", () => {
        expect(new GroupsError("message") instanceof GroupsError).toBe(true);
    });
    
    it("it should create error without parameters", () => {
        expect(new GroupsNotAuthenticated("message") instanceof GroupsNotAuthenticated).toBe(true);
    });
    
    it("it should create error without parameters", () => {
        expect(new GroupsUpdate("message") instanceof GroupsUpdate).toBe(true);
    });
    
    it("it should create error without parameters", () => {
        expect(new GroupsNotAuthorized("message") instanceof GroupsNotAuthorized).toBe(true);
    });
    
    
});