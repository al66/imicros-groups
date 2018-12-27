# imicros-groups
[![Build Status](https://travis-ci.org/al66/imicros-groups.svg?branch=master)](https://travis-ci.org/al66/imicros-groups)
[![Coverage Status](https://coveralls.io/repos/github/al66/imicros-groups/badge.svg?branch=master)](https://coveralls.io/github/al66/imicros-groups?branch=master)

[Moleculer](https://github.com/moleculerjs/moleculer) service for managing usergroups

## Installation
```
$ npm install imicros-groups --save
```
## Dependencies
Requires a running [Neo4j](https://neo4j.com/) instance.

# Usage
## Usage ...
```js
const { ServiceBroker } = require("moleculer");
const { Groups } = require("imicros-groups");

broker = new ServiceBroker({
    logger: console
});
service = broker.createService(Groups, Object.assign({ 
    settings: { 
        uri: "bolt://localhost:7474"
    } 
}));
broker.start();


```

## Options

## Actions
- add { name } => { id (new group), name (new group), userId, role }  
- get { id } => { id (group), name (group), relation (MEMBER_OF), role  }  
- list { limit, offset } => { id (group), name (group), relation (MEMBER_OF|INVITED_BY), role, hide (true|false) }
- rename { id, name } => { id (group), name (new name) }
- invite { id, email, role (optional) } => { id (group), name (new name), invited (email), role }
- refuse { id } => { id (group), name (group) }
- hide { id, unhide (optional, true|false) } => { id (group), name (group, hide (true|false) }
- nominate { groupId, userId } => { newRole }
- revoke { groupId, userId } => { newRole }
- remove { groupId, userId } => { userId, groupId }
- setRole { groupId, userId, role } => { userId, groupId, role }
- members { id (group) } => { id (user), role }
- invitations { id (group) } => { email, role }
- join { id (group) } => { id (group), role }
- alias { id (group), alias } => { id (group), name (group), alias }
- leave { id (group) } => { id (group), role, email }
- addGrant { byGroupId, forGroupId, ruleset } => { byGroupId, forGroupId, ruleset }
- removeGrant { byGroupId, forGroupId } => { removed }
- access {} => { id (group), relation (MEMBER_OF|GRANT), ruleset }




