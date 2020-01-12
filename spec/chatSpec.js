'use strict';

describe('chat', function() {

    var Chat = require('../chat');
    var broadcast = require('../broadcast');


    beforeEach(function() {
        Chat.clear();
    });


    it('should filter xss attacks', function() {
        var room = new Chat('room');
        room.add({}, '<SCRIPT SRC=http://ha.ckers.org/xss.js></SCRIPT>');
        expect(broadcast.lastMessage.data.txt).toBe('[removed][removed]');
    });


    it('should limit messages to 100 chars', function() {
        var room = new Chat('room');
        var txt = '!!!!!!!!!! !!!!!!!!!! !!!!!!!!!! !!!!!!!!!! !!!!!!!!!! !!!!!!!!!! !!!!!!!!!! !!!!!!!!!! !!!!!!!!!! !!!!!!!!!! !!!!!!!!!!'; //something like 120 characters
        room.add({}, txt);
        expect(broadcast.lastMessage.data.txt.length).toBe(100);
    });


    it('should create new rooms', function() {
        var room1 = new Chat('room1');
        var room2 = new Chat('room2');
        expect(room1.roomName).toBe('room1');
        expect(Chat.getRoom('room2')).toBe(room2);
    });


    it('should store messages', function() {
        var room = new Chat('room1');
        room.add({name:'bob'}, 'hi');
        room.add({name:'bob'}, 'well');
        expect(room.msgs.length).toBe(2);
    });


    it('should prune old messages', function() {
        var room = new Chat('batman');
        for(var i=0; i<25; i++) {
            room.add({name:'feilix'}, 'str'+i);
        }
        expect(room.msgs.length).toBe(20);
    });

});