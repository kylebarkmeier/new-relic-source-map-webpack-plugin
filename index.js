'use strict';
const uploadSourceMap = require('./src/uploadSourceMap');
const staticAssetUrlBuilder = require('./src/staticAssetUrlBuilder');
const enforceExists = require('./src/enforceExists');

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
        this.repoUrl = options.repoUrl || null;
        this.buildCommit = options.buildCommit || null;
        this.errorCallback = options.errorCallback || this._getDefaultErrorCallback();
    }
    apply(compiler) {
        compiler.hooks.done.tapPromise('new-relic-source-map-webpack-plugin', stats => {
            const chunks = stats.compilation.chunks;
            const assets = [];

            chunks
                .map(chunk => chunk.files)
                .map(files => {
                    const mapRegex = /\.map(\?|$)/;
                    const fileName = files.find(file => this.extensionRegex.test(file));
                    const mapName = files.find(
                        file =>
                            this.extensionRegex.test(file.split('.map')[0]) && mapRegex.test(file)
                    );

                    if (fileName && mapName) {
                        assets.push({ fileName, mapName });
                    }
                });

            if (assets.length === 0) {
                this.errorCallback(
                    'No sourcemaps were found. Check if sourcemaps are enabled: https://webpack.js.org/configuration/devtool/'
                );
                return Promise.resolve();
            }

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
                      repoUrl: this.repoUrl,
                      buildCommit: this.buildCommit,
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
