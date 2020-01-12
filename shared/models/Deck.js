'use strict';

var mongoose = require("mongoose");
var validate = require('mongoose-validator').validate;
var sanitize = require('validator').sanitize;
var Card = require('./Card'); // makes sure Card is loaded first

var DeckSchema = new mongoose.Schema({
    _id: {
        type: String,
        index: true,
        validate: validate('len', 1, 100)
    },
    name: {
        type: String,
        required: true,
        trim: true,
        set: function(val) { return(sanitize(val).xss()); }
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    cards: [{
        type: String,
        required: true,
        ref: 'Card',
        validate: validate('len', 10, 30)
    }],
    pride: {
        type: Number,
        min: 0,
        default: 0
    },
    updated: {
        type: Date,
        default: Date.now
    },
    share: {
        type: Boolean
    }
});

//check(deck.cards.length, 'card should be an array containing no more than 100 values').min(0).max(100);

module.exports = mongoose.model('Deck', DeckSchema);