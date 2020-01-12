'use strict';

var _ = require('lodash');
var events = require('events');
var DiffTracker = require('../fns/diffTracker');
var Board = require('../shared/Board');
var broadcast = require('../broadcast');
var actionFns = require('./actionFns');
var defaultRules = require('./defaultRules');
var gameLookup = require('./gameLookup');
var initAccounts = require('./initAccounts');
var Loadup = require('./Loadup');
var TurnTicker = require('./turnTicker');
var Effects = require('./effects/Effects');
var FutureManager = require('./futures/FutureManager');


/**
 * preload decks, then loop through player turns until someone wins
 * @param {[object]} accounts
 * @param {object} rules
 * @param {string} gameId
 */
module.exports = function (accounts, rules, gameId) {
    var self = this;


    /**
     * constants
     */
    self.STARTUP = 'startup';
    self.TURN_BEGIN = 'turnBegin';
    self.TURN_END = 'turnEnd';
    self.ABILITY_BEFORE = 'abilityBefore';
    self.ABILITY_DURING = 'abilityDuring';
    self.ABILITY_AFTER = 'abilityAfter';
    self.CHANGE = 'change';
    self.PRIZES_SAVED = 'prizesSaved';
    self.RECORD_SAVED = 'recordSaved';
    self.END = 'end';


    /**
     * just exit if no players are here
     */
    if (accounts.length === 0) {
        return;
    }


    /**
     * initialize variables and helper classes
     */
    self._id = gameId;
    self.state = 'loadup';
    self.rules = _.defaults(rules, defaultRules);
    self.eventEmitter = new events.EventEmitter();
    self.futureManager = new FutureManager(self);
    self.players = initAccounts(accounts);
    self.board = new Board(self.players, rules.columns, rules.rows);
    self.turnTicker = new TurnTicker(self.players, rules.turnDuration);
    self.diffTracker = new DiffTracker();
    self.effects = new Effects(self);


    /**
     * preload decks and futures
     */
    self.loadup = new Loadup(self.players, rules, function () {


        /**
         * get ready to play
         */
        self.state = 'running';
        self.eventEmitter.emit(self.STARTUP, self);


        /**
         * start the turn ticker
         */
        self.turnTicker.start(


            /**
             * at the start of every turn
             * @param {Number} startTime
             */
            function (startTime) {
                self.turnOwners = self.turnTicker.turnOwners;
                self.broadcastChanges('turn');
                self.eventEmitter.emit(self.TURN_BEGIN, self, startTime);
            },


            /**
             * at the end of every turn
             * @param {Number} elapsed
             */
            function (elapsed) {
                self.eventEmitter.emit(self.TURN_END, self, elapsed);
            }
        );
    });


    /**
     *
     */
    self.eventEmitter.on(self.RECORD_SAVED, function () {
        self.emit('gameOver', {
            winners: _.map(self.winners, function (winner) {
                return winner._id;
            })
        });
        _.delay(self.remove, 1000);
    });


    /**
     *
     * @param {Array.<Player>} winners
     */
    self.setWinners = function (winners) {
        if(self.state === 'running') {
            self.winners = winners;
            self.state = 'awarding';
            self.turnTicker.stop();
            self.eventEmitter.emit(self.END, self);
        }
    };


    /**
     * Find a card with the provided cid
     * @param cards
     * @param cid
     * @returns {*}
     */
    self.cidToCard = function (cards, cid) {
        var matchCard = null;
        _.each(cards, function (card) {
            if (card.cid === cid) {
                matchCard = card;
            }
        });
        return matchCard;
    };




    // todo move this somewhere better
    /**
     * Create an array of every card in the game
     * @returns {Array}
     */
    self.allCards = function () {
        var cards = [];

        // loop through each player
        _.each(self.players, function (player) {

            // cards on the board
            _.each(self.board.playerTargets(player._id), function (target) {
                if (target.card) {
                    cards.push(target.card);
                }
            });

            // cards in hand
            _.each(player.hand, function (card) {
                cards.push(card);
            });

            // cards in graveyard
            _.each(player.graveyard, function (card) {
                cards.push(card);
            });
        });

        return cards;
    };



    /**
     * Find a player using their id
     * @param {number} id
     * @returns {Player} player
     */
    self.idToPlayer = function (id) {
        var match = null;
        _.each(self.players, function (player) {
            if (String(player._id) === String(id)) {
                match = player;
            }
        });
        return match;
    };


    /**
     * Returns a snapshot of everything in this game
     */
    self.getStatus = function () {
        var status = {};

        status.players = _.assign({}, _.map(self.players, function (player) {
            return _.pick(player, '_id', 'team', 'name', 'site', 'pride');
        }));

        status.future = self.futureManager.curFutureId;
        status.board = self.board.getMini();
        status.turn = self.turnTicker.turn;
        status.turnOwners = self.turnTicker.getTurnOwnerIds();
        status.timeLeft = Math.round(self.turnTicker.getTimeLeft() / 1000);
        status.state = self.state;

        return status;
    };


    /**
     * End a player's turn
     * @param player
     * @returns {string}
     */
    self.endTurn = function (player) {
        if (!self.turnTicker.isTheirTurn(player)) {
            return 'it is not your turn';
        }
        self.turnTicker.endTurn();
        return 'ok';
    };


    /**
     * broadcast to subscribers
     * @param {string} event
     * @param {*} data
     */
    self.emit = function (event, data) {
        broadcast(gameId, event, data);
    };


    /**
     * broadcast changes as a partial update
     */
    self.broadcastChanges = function (cause, data) {
        var status = self.getStatus();
        var changes = self.diffTracker.diff(status, false);
        if (!_.isEmpty(changes)) {
            self.emit('gameUpdate', {
                cause: cause,
                changes: changes,
                data: data
            });
            self.eventEmitter.emit(self.CHANGE, self, cause, changes, data);
        }
    };


    /**
     * If it is the accounts turn, pass the action on to the table
     * @param {Player} player
     * @param {String} actionId
     * @param {Array} targetChain
     */
    self.doAction = function (player, actionId, targetChain) {

        // its gotta be your turn
        if (!self.turnTicker.isTheirTurn(player)) {
            return 'it is not your turn';
        }

        // pre action
        self.actionError = null;
        self.eventEmitter.emit(self.ABILITY_BEFORE, self, player, actionId, targetChain);
        if (self.actionError) {
            return {
                err: self.actionError
            };
        }

        // do the action
        var result = actionFns.doAction(self, player, actionId, targetChain);
        if (result && result.err) {
            return result;
        }

        // broadcast if the action was successful
        self.eventEmitter.emit(self.ABILITY_DURING, self, actionId, targetChain, result);
        self.broadcastChanges(actionId, {
            result: result,
            targetChain: targetChain
        });
        self.eventEmitter.emit(self.ABILITY_AFTER, self);
        return {
            success: true
        };

    };


    /**
     * Clean up for removal
     */
    self.remove = function () {
        self.state = 'removed';
        accounts = null;
        self.board.clear();
        self.turnTicker.stop();
        self.eventEmitter.removeAllListeners();
        gameLookup.deleteId(gameId);
    };


    /**
     * forfeit a player from the game
     */
    self.forfeit = function (player) {
        if(!player.forfeited) {
            player.cards = [];
            player.hand = [];
            player.graveyard = [];
            player.forfeited = true;
            self.board.areas[player._id].targets = [];
            self.broadcastChanges('forfeit');
            self.endTurn(player);
        }
    };



    /**
     * Store this game so it can be accessed from gameInterface.js
     */
    gameLookup.store(gameId, self);
};