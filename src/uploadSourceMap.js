'use strict';
const { publishSourcemap } = require('@newrelic/publish-sourcemap');

module.exports = opts => assets => {
    const {
        staticAssetUrlBuilder,
        publicPath,
        outputPath,
        applicationId,
        nrAdminKey,
        url,
        releaseName,
        releaseId,
    } = opts;

    const javascriptUrl = staticAssetUrlBuilder(url, publicPath, assets.js);
    const sourcemapPath = outputPath + '/' + assets.map;

    return new Promise((resolve, reject) => {
        publishSourcemap(
            {
                sourcemapPath,
                javascriptUrl,
                applicationId,
                nrAdminKey,
                releaseName,
                releaseId,
            },
            err => {
                if (err) {
                    reject(err);
                }
                resolve(javascriptUrl);
            }
        );
    });
};
