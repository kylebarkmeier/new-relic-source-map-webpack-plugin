const { publishSourcemap } = require('@newrelic/publish-sourcemap');
const NewRelicSourceMapPlugin = require('../index.js');
const path = require('path');
const webpack = require('webpack');

const spyConsoleWarn = jest.spyOn(global.console, 'warn');
jest.mock('@newrelic/publish-sourcemap');
jest.setTimeout(10000);

function getConfig(config = {}) {
    const defaultConfigs = {
        context: path.resolve(__dirname),
        entry: './__fixtures__/test.js',
        mode: 'production',
        devtool: 'source-map',
        output: {
            path: path.resolve(__dirname, '__output__'),
            publicPath: '/test/publicPath',
        },
        plugins: [
            new NewRelicSourceMapPlugin({
                applicationId: 'id',
                nrAdminKey: 'key',
                staticAssetUrl: 'http://examplecdn.com',
            }),
        ],
    };
    return Object.assign({}, defaultConfigs, config);
}

beforeEach(() => {
    jest.clearAllMocks();
    publishSourcemap.mockImplementation((options, cb) => {
        cb();
    });
});

it('throw an error if there is no application id', () => {
    const testFn = () => {
        new NewRelicSourceMapPlugin({
            nrAdminKey: 'key',
            staticAssetUrl: 'http://examplecdn.com',
        });
    };
    expect(testFn).toThrowError('applicationId is required');
});

it('doesnt throw an error if there is no application id if noop is true', () => {
    const testFn = () => {
        new NewRelicSourceMapPlugin({
            noop: true,
            nrAdminKey: 'key',
            staticAssetUrl: 'http://examplecdn.com',
        });
    };
    expect(testFn).not.toThrowError('applicationId is required');
});

it('throw an error if there is no staticAssetUrl', () => {
    const testFn = () => {
        new NewRelicSourceMapPlugin({
            nrAdminKey: 'key',
            applicationId: 'id',
        });
    };
    expect(testFn).toThrowError('staticAssetUrl is required');
});

it('throw an error if there is no nrAdminKey', () => {
    const testFn = () => {
        new NewRelicSourceMapPlugin({
            applicationId: 'key',
            staticAssetUrl: 'http://examplecdn.com',
        });
    };
    expect(testFn).toThrowError('nrAdminKey is required');
});

it('accepts a user defined staticAssetUrlBuilder', done => {
    const staticAssetUrlBuilder = () => 'customStaticAssertUrlBuilder.js';
    const config = getConfig({
        plugins: [
            new NewRelicSourceMapPlugin({
                applicationId: 'id',
                nrAdminKey: 'key',
                staticAssetUrl: 'http://examplecdn.com',
                staticAssetUrlBuilder,
            }),
        ],
    });

    webpack(config, (err, stats) => {
        expect(publishSourcemap).toHaveBeenCalledWith(
            expect.objectContaining({
                javascriptUrl: 'customStaticAssertUrlBuilder.js',
            }),
            expect.any(Function)
        );
        done();
    });
});

it('accepts a user defined extensionRegex', done => {
    const extensionRegex = /\.css/;
    const config = getConfig({
        plugins: [
            new NewRelicSourceMapPlugin({
                applicationId: 'id',
                nrAdminKey: 'key',
                staticAssetUrl: 'http://examplecdn.com',
                extensionRegex,
            }),
        ],
    });

    webpack(config, (err, stats) => {
        expect(publishSourcemap).not.toBeCalled();
        done();
    });
});

it('accepts a user defined errorCallback', done => {
    let consoleOutput = [];
    const errorCallback = err => consoleOutput.push(err);
    const config = getConfig({
        plugins: [
            new NewRelicSourceMapPlugin({
                applicationId: 'id',
                nrAdminKey: 'key',
                staticAssetUrl: 'http://examplecdn.com',
                errorCallback,
            }),
        ],
        devtool: false,
    });

    webpack(config, (err, stats) => {
        expect(consoleOutput.length !== 0).toBe(true);
        done();
    });
});

it('sets apply to a noop if noop is passed', done => {
    const config = getConfig({
        plugins: [
            new NewRelicSourceMapPlugin({
                applicationId: 'id',
                nrAdminKey: 'key',
                staticAssetUrl: 'http://examplecdn.com',
                noop: true,
            }),
        ],
    });

    webpack(config, (err, stats) => {
        expect(publishSourcemap).not.toBeCalled();
        done();
    });
});

it('passes right args to publishSourcemap', done => {
    const config = getConfig({
        plugins: [
            new NewRelicSourceMapPlugin({
                applicationId: 'id',
                nrAdminKey: 'key',
                staticAssetUrl: 'http://examplecdn.com',
                releaseName: 'releaseName',
                releaseId: '111',
            }),
        ],
    });

    webpack(config, (err, stats) => {
        expect(publishSourcemap).toHaveBeenCalledWith(
            {
                sourcemapPath: expect.any(String),
                javascriptUrl: 'http://examplecdn.com/test/publicPath/main.js',
                applicationId: 'id',
                nrAdminKey: 'key',
                releaseName: 'releaseName',
                releaseId: '111',
            },
            expect.any(Function)
        );
        done();
    });
});

it('succeeds to upload when futureEmitAssets:false', done => {
    const config = getConfig();

    webpack(config, (err, stats) => {
        expect(publishSourcemap).toBeCalled();
        expect(spyConsoleWarn).not.toBeCalled();
        done();
    });
});

it('succeeds to upload when futureEmitAssets:true', done => {
    const config = getConfig({
        output: {
            path: path.resolve(__dirname, '__output__'),
            publicPath: '/test/publicPath/',
            futureEmitAssets: true,
        },
    });

    webpack(config, (err, stats) => {
        expect(publishSourcemap).toBeCalled();
        expect(spyConsoleWarn).not.toBeCalled();
        done();
    });
});

it('logs the error when source-map is disabled', done => {
    const config = getConfig({
        devtool: false,
    });

    webpack(config, (err, stats) => {
        expect(
            spyConsoleWarn.mock.calls.some(call =>
                call.includes(
                    'New Relic sourcemap upload error: No sourcemaps were found. Check if sourcemaps are enabled: https://webpack.js.org/configuration/devtool/'
                )
            )
        ).toBe(true);
        done();
    });
});

it('prints a warning message if a sourcemap upload fails', done => {
    const errorMessage = 'error';
    const config = getConfig();
    publishSourcemap.mockImplementation((obj, cb) => {
        cb(errorMessage);
    });

    webpack(config, (err, stats) => {
        expect(
            spyConsoleWarn.mock.calls.some(call =>
                call.includes(`New Relic sourcemap upload error: ${errorMessage}`)
            )
        ).toBe(true);
        done();
    });
});

it('succeeds to upload when filename has a question mark in it', done => {
    const config = getConfig({
        output: {
            filename: '[name].js?v=1',
            path: path.resolve(__dirname, '__output__'),
        },
    });

    webpack(config, (err, stats) => {
        expect(publishSourcemap).toBeCalled();
        expect(spyConsoleWarn).not.toBeCalled();
        done();
    });
});

describe('javascriptUrl', () => {
    it('combines the url, publicPath, and filename', done => {
        const config = getConfig();

        webpack(config, (err, stats) => {
            expect(publishSourcemap).toHaveBeenCalledWith(
                expect.objectContaining({
                    javascriptUrl: 'http://examplecdn.com/test/publicPath/main.js',
                }),
                expect.any(Function)
            );
            done();
        });
    });

    it('removes trailing slashes from publicPath and url if present', done => {
        const config = getConfig({
            output: {
                path: path.resolve(__dirname, '__output__'),
                publicPath: '/test/publicPath/',
                futureEmitAssets: true,
            },
            plugins: [
                new NewRelicSourceMapPlugin({
                    applicationId: 'id',
                    nrAdminKey: 'key',
                    staticAssetUrl: 'http://examplecdn.com/',
                }),
            ],
        });

        webpack(config, (err, stats) => {
            expect(publishSourcemap).toHaveBeenCalledWith(
                expect.objectContaining({
                    javascriptUrl: 'http://examplecdn.com/test/publicPath/main.js',
                }),
                expect.any(Function)
            );
            done();
        });
    });

    it('omits publicPath when its value is undefined', done => {
        const config = getConfig({
            output: {
                path: path.resolve(__dirname, '__output__'),
                futureEmitAssets: true,
            },
        });

        webpack(config, (err, stats) => {
            expect(publishSourcemap).toHaveBeenCalledWith(
                expect.objectContaining({
                    javascriptUrl: 'http://examplecdn.com/main.js',
                }),
                expect.any(Function)
            );
            done();
        });
    });
});
