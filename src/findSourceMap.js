'use strict';
module.exports = children => {
    return (children || []).reduce((m, i) => {
        if (typeof i === 'string' && i.includes('sourceMappingURL=')) {
            m = i.split('sourceMappingURL=')[1];
        }
        return m;
    }, '');
};
