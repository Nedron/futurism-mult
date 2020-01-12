var _ = require('lodash');
var mongoose = require('mongoose');
var validate = require('mongoose-validator').validate;
var sanitize = require('validator').sanitize;
var factions = require('../factions');


var validateAbilities = [
    {
        validator: function(arr, next) {
            return next(arr.length < 9);
        },
        msg: 'Abilities should be an array containing up to nine abilities.'
    },
    {
        validator: function(arr, next) {
            _.each(arr, function(val) {
                if(val.length !== 4) {
                    return next(false);
                }
            });
            return next(true);
        },
        msg: 'Each ability should be four characters long.'
    }
];


var CardSchema = new mongoose.Schema({
    _id: {
        type: String,
        index: true,
        validate: validate('len', 1, 100)
    },
    share: {
        type: Boolean
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    name: {
        type: String,
        required: true,
        trim: true,
        validate: validate('len', 1, 20)
    },
    faction: {
        type: String,
        enum: ['no', factions.ent.id, factions.machine.id, factions.elite.id, factions.zealot.id],
        default: 'no'
    },
    attack: {
        type: Number,
        set: Math.round,
        min: 0,
        max: 9,
        default: 0
    },
    health: {
        type: Number,
        set: Math.round,
        min: 0,
        max: 9,
        default: 1
    },
    story: {
        type: String,
        trim: true,
        validate: validate('len', 0, 99),
        set: function(val) { return(sanitize(val).xss()); }
    },
    abilities: {
        type: Array,
        validate: validateAbilities,
        default: []
    },
    updated: {
        type: Date,
        default: Date.now
    },
    hasImage: {
        type: Boolean,
        default: false
    },
    version: {
        type: Number,
        default: 0
    }
});


CardSchema.post('validate', function (doc) {
    doc.version++;
});


var Card = mongoose.model('Card', CardSchema);
module.exports = Card;