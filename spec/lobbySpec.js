'use strict';

describe('lobby', function() {

    var broadcast = require('../broadcast');
    var Lobby = require('../lobby');

    var lobby;


    beforeEach(function() {
        lobby = Lobby.createRoom('tester');
    });


    afterEach(function() {
        lobby.clear();
    });


    it('should create a matchup', function() {
        var matchup1 = lobby.createMatchup({_id:15}, {maxPride:20});
        expect(matchup1.accounts[0]._id).toBe(15);
        expect(matchup1.rules.maxPride).toBe(20);

        var matchup2 = lobby.createMatchup({_id:123}, {maxPride:20});
        expect(matchup2.accounts[0]._id).toBe(123);
    });


    it('should remove a matchup if everyone leaves', function() {
        var user = {_id:15};
        var matchup = lobby.createMatchup(user, {maxPride:20});
        expect(lobby.matchups.idToValue(matchup.id)).toBeTruthy();

        lobby.leaveMatchup(user);
        expect(lobby.matchups.idToValue(matchup.id)).toBeFalsy();
    });


    it('should not let the same user exist in two matchups', function() {
        var user = {_id:15};
        var matchup1 = lobby.createMatchup(user, {maxPride:20});
        expect(matchup1.accounts.length).toBe(1);
        
        var matchup2 = lobby.createMatchup(user, {maxPride:25});
        expect(matchup1.accounts.length).toBe(0);
        expect(matchup2.accounts.length).toBe(1);
        expect(lobby.matchups.toArray().length).toBe(1);
        expect(lobby.matchups.toArray()[0].rules.maxPride).toBe(25);

        var err = lobby.joinMatchup(user, matchup2.id);
        expect(err).toContain('already');

        var user2 = {_id:1};
        var matchup3 = lobby.createMatchup(user2, {maxPride:70, players: 4});
        lobby.joinMatchup(user, matchup3.id);
        expect(lobby.matchups.toArray().length).toBe(1);
        expect(lobby.matchups.toArray()[0].accounts.length).toBe(2);
    });


    it('should start a match that has reached its player count', function() {
        var user1 = {_id:1, hand: [], deck: []};
        var user2 = {_id:2, hand: [], deck: []};
        var user3 = {_id:3, hand: [], deck: []};

        var matchup = lobby.createMatchup(user1, {players:3, pride:50});
        lobby.joinMatchup(user2, matchup.id);
        lobby.joinMatchup(user3, matchup.id);
        expect(broadcast.lastMessage.event).toBe('startMatchup');
    });

});