# imicros-groups
[![Build Status](https://travis-ci.org/al66/imicros-groups.svg?branch=master)](https://travis-ci.org/al66/imicros-groups)
[![Coverage Status](https://coveralls.io/repos/github/al66/imicros-groups/badge.svg?branch=master)](https://coveralls.io/github/al66/imicros-groups?branch=master)

[Moleculer](https://github.com/moleculerjs/moleculer) service for managing usergroups (workspaces) and authorizations

## Installation
```
$ npm install imicros-groups --save
```
## Dependencies
Requires a running [Neo4j](https://neo4j.com/) instance - refer to [example](#Docker).

# Usage
## Preconditions
The service expects user id and email to be set in ctx.meta data as follows:
```
ctx.meta.user = {
    id: 'unique ID of the user (number or string)',
    email: 'user@test.org'
}
```
Otherwise the service throws GroupsNotAuthenticated error.

## Usage groups service
```js
const { ServiceBroker } = require("moleculer");
const { Groups } = require("imicros-groups");

broker = new ServiceBroker({
    logger: console
});
service = broker.createService(Groups, Object.assign({ 
    settings: { 
        uri: "bolt://neo4j_groups:7474",
        user: "neo4j",
        password: "neo4j"
    } 
}));
broker.start();

```
## Usage authorization mixin
### Add a new ressource
```js
// call method of autorization mixin (user must be member of the group to add new ressources)
let uid = await this.registerRessource({ resId: 'Optional, external uid', groupId: 'id of the owner group'});

```
### Check authorization
```js
// call method of autorization mixin
await this.isAutorized({ resId: 'id of ressource', action: 'name of the called action or a specific command like read,write,update'});

```
## Actions (groups service)
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
- addGrant { byGroupId, forGroupId, service, action, forRessourceId, forFolderId } => { byGroupId, forGroupId, service, action }
- removeGrant { byGroupId, forGroupId, service, action, forRessourceId, forFolderId } => { removed }
- isAuthorized { resId, service, action } => { owner (true|false), service, action } | empty array (not authorized)


## Docker
### Neo4j - example docker-compose file
```
version: '3'

services:

    neo4j:
        image: neo4j
        container_name: neo4j_groups
    
        # only necessary for access neo4j directly via webinterface 
        ports:
        - "7474:7474"
        - "7687:7687"
        
        #environment:
        #  NEO4J_AUTH: 'none'
        
        volumes:
        - ./data:/data
```
### imicros-groups - example docker-compose file
Copy first the files under docker in this repository to the docker folder and adopt uri, user and password in file services/groups.service.js.
Necessary networks can be created with ```docker network create NETWORK```.
```
version: '3'
services:

  groups:
    build:
      context: .
    image: imicros-groups

    environment:
      SERVICES: groups

    external_links:
      - nats
      - neo4j_groups
      
    networks:
      - nats_default
      - neo4j_default
      
    restart: always

networks:
  nats_default:
    external: true
  neo4j_default:
    external: true
```
