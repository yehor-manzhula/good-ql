const _ = require('lodash');
const Hoek = require('hoek');
const gql = require('graphql-tag');
const graphql = require('graphql-anywhere');

const internals = {
    
    defaults: {},

    utils: {
        resolver(fieldName, root, modifiers) {
            const {excludeTypeHandlers} = internals.utils;
            const {filter, modify, mask, excludeTypes} = modifiers || {};
            
            let value = root[fieldName];

            if (filter) {
                value = _.filter(value, filter);
            }

            if (modify) {
                value = _.mapKeys(value, (value, key) => _[modify](key));
            }

            if (mask && _.isObject(value)) {
                value = _.cloneDeepWith(value, (value, key) => {
                    if (key !== mask) {
                        return;
                    }

                    if (_.isString(value)) {
                        return 'String:HIDDEN_DATA';
                    }

                    if (_.isNumber(value)) {
                        return 'Number:HIDDEN_DATA';
                    }

                    if (_.isObject(value)) {
                        return 'Object:HIDDEN_DATA';
                    }
                });
            }

            if (excludeTypes) {
                const toExclude = _.isArray(excludeTypes) ? excludeTypes : [excludeTypes];

                if (!toExclude.length) {
                    return;
                }

                value = _.cloneDeepWith(value, value => {
                    for (let i = 0, len = toExclude.length; i < len; i++) {
                        const excludeType = toExclude[i];
                        
                        const result = _.get(excludeTypeHandlers, 
                            _.toUpperCase(excludeType), 
                            excludeTypeHandlers.DEFAULT)(value);
                        
                        if (result) {
                            return result;
                        }
                    }
                });
            }

            return value;
        },

        excludeTypeHandlers: {

            DEFAULT() {},

            STREAM(value) {
                if (value instanceof Stream) {
                    return 'Stream:EXCLUDED';
                }
            }
        }
    }
};

class GoodQl extends Stream.Transform {

    constructor(config) {
        super({objectMode: true});
        this._settings = Hoek.applyToDefaults(internals.defaults, config);
    }

    _transform(data, enc, next) {
        let picked = data;
        
        try {
            picked = this._pick(data);
        } catch (e) {
            console.error('good-ql pick data error', e);
        }

        return next(null, picked);
    }

    _pick(data) {
        const pickSchema = this._settings[data.event];
        /**
         *  @description
         *  By default filter out all 
         *  that is not specified
         */
        if (!pickSchema) {
            return data;
        }

        return graphql.default(internals.utils.resolver, gql`${pickSchema}`, data);
    }
}

module.exports = GoodQl;
