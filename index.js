'use strict';
const uploadSourceMap = require('./src/uploadSourceMap');
const staticAssetUrlBuilder = require('./src/staticAssetUrlBuilder');
const enforceExists = require('./src/enforceExists');
const findSourceMap = require('./src/findSourceMap');
const PLUGIN_NAME = 'new-relic-source-map-webpack-plugin';

class NewRelicPlugin {
    constructor(options) {
        if (options.noop) {
            this.apply = () => {};
            return;
        }
        this.applicationId = enforceExists(options, 'applicationId');
        this.nrAdminKey = enforceExists(options, 'nrAdminKey');
        this.staticAssetUrl = enforceExists(options, 'staticAssetUrl');
        this.staticAssetUrlBuilder = options.staticAssetUrlBuilder || staticAssetUrlBuilder;
        this.extensionRegex = options.extensionRegex || /\.js(\?|$)/;
        this.releaseName = options.releaseName || null;
        this.releaseId = options.releaseId || null;
        this.errorCallback = options.errorCallback || this._getDefaultErrorCallback();
        this.assets = [];
    }
    apply(compiler) {
        compiler.hooks.emit.tap(PLUGIN_NAME, compilation => {
            for (const [assetName, assetObj] of Object.entries(compilation.assets)) {
                if (this.extensionRegex.test(assetName)) {
                    const mapAssetName = findSourceMap(assetObj.children);
                    const mapFile = compilation.assets[mapAssetName];

                    if (mapFile) {
                        this.assets.push({ js: assetName, map: mapAssetName });
                    }
                }
            }
            if (this.assets.length === 0) {
                this.errorCallback(
                    'No sourcemaps were found. Check if sourcemaps are enabled: https://webpack.js.org/configuration/devtool/'
                );
            }
        });

        compiler.hooks.done.tapPromise(PLUGIN_NAME, stats => {
            return Promise.all(
                this.assets.map(
                    uploadSourceMap({
                        staticAssetUrlBuilder: this.staticAssetUrlBuilder,
                        url: this.staticAssetUrl,
                        publicPath: stats.compilation.outputOptions.publicPath,
                        outputPath: stats.compilation.outputOptions.path,
                        nrAdminKey: this.nrAdminKey,
                        applicationId: this.applicationId,
                        releaseName: this.releaseName,
                        releaseId: this.releaseId,
                    })
                )
            )
                .then(values => {
                    values.forEach(v => console.log(`sourceMap for ${v} uploaded to newrelic`));
                })
                .catch(err => {
                    this.errorCallback(err);
                });
        });
    }
    _getDefaultErrorCallback() {
        return err => {
            console.warn(`New Relic sourcemap upload error: ${err}`);
        };
    }
}

module.exports = NewRelicPlugin;
