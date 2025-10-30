#!/usr/bin/env node

/**
 * Build script for minifying the bookmarklet
 *
 * This script:
 * 1. Reads bookmarklet-source.js
 * 2. Minifies it using Terser
 * 3. Prefixes with 'javascript:'
 * 4. Writes to bookmarklet-production.js
 */

const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

const SOURCE_FILE = path.join(__dirname, '../bookmarklet/bookmarklet-source.js');
const OUTPUT_FILE = path.join(__dirname, '../bookmarklet/bookmarklet-production.js');

async function buildBookmarklet() {
    try {
        console.log('Reading source file...');
        const sourceCode = fs.readFileSync(SOURCE_FILE, 'utf8');

        console.log('Minifying...');
        const result = await minify(sourceCode, {
            compress: {
                dead_code: true,
                drop_console: false,
                drop_debugger: true,
                keep_classnames: false,
                keep_fargs: true,
                keep_fnames: false,
                keep_infinity: false,
            },
            mangle: {
                toplevel: false,
            },
            format: {
                comments: false,
                wrap_iife: false,
            },
        });

        if (result.error) {
            throw result.error;
        }

        // Add javascript: prefix
        const bookmarklet = 'javascript:' + result.code;

        console.log('Writing output file...');
        fs.writeFileSync(OUTPUT_FILE, bookmarklet + '\n', 'utf8');

        const originalSize = sourceCode.length;
        const minifiedSize = bookmarklet.length;
        const savings = ((1 - minifiedSize / originalSize) * 100).toFixed(1);

        console.log('\n✓ Bookmarklet built successfully!');
        console.log(`  Original size: ${originalSize} bytes`);
        console.log(`  Minified size: ${minifiedSize} bytes`);
        console.log(`  Size reduction: ${savings}%`);
        console.log(`\n  Output: ${OUTPUT_FILE}`);

    } catch (error) {
        console.error('Error building bookmarklet:', error);
        process.exit(1);
    }
}

buildBookmarklet();
