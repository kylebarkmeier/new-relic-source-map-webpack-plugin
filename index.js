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
    }
    apply(compiler) {
        compiler.hooks.done.tapPromise(PLUGIN_NAME, stats => {
            const jsonStats = stats.toJson();
            let assets = [];
            
            Object.values(jsonStats.assetsByChunkName).map(assets => {
                //when devtools: false, it will return string instead of array
                if (Array.isArray(assets)) {
                    const mapRegex = /\.map(\?|$)/;
                    const fileName = assets.find(asset => this.extensionRegex.test(asset));
                    const mapName = assets.find(
                        asset =>
                            this.extensionRegex.test(asset.split('.map')[0]) && mapRegex.test(asset)
                    );
                    if (fileName && mapName) {
                        assets.push({ fileName, mapName });
                    }
                }
            });

            if (assets.length === 0) {
                this.errorCallback(
                    'No sourcemaps were found. Check if sourcemaps are enabled: https://webpack.js.org/configuration/devtool/'
                );
                return Promise.resolve();
            } else {
                return Promise.all(
                    assets.map(
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
            }
        });
    }
    _getDefaultErrorCallback() {
        return err => {
            console.warn(`New Relic sourcemap upload error: ${err}`);
        };
    }
}

module.exports = NewRelicPlugin;
