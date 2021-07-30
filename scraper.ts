import fs, { PathLike } from 'fs';
import http from 'http';
import path from 'path';

import glob from 'glob';
import arg from 'arg';
import to from 'await-to-js';
import async from 'async';

const download = (object: { url: string, destination: string }, callback?: Function) => {
    const { url, destination } = object;
    const file: any = fs.createWriteStream(destination);
    const request = http.get(url, function (response) {
        fs.mkdir(path.parse(destination).dir, { recursive: true }, (err) => {
            if (err) throw err;

            response.pipe(file);
            file.on('finish', function () {
                file.close(callback);  
            });
        });
    }).on('error', function (err) { 
        if (callback) callback(err.message);
    });
};

const writeObjectToFile = (data: any, destination: string) => {
    fs.mkdir(path.parse(destination).dir, { recursive: true }, (err) => {
        if (err) throw err;

        fs.writeFile(destination, JSON.stringify(data, null, 4), (e) => console.log('writeFile::', e));
    });
};

const slufigy = (str) => {
    str = str.replace(/^\s+|\s+$/g, ''); // trim
    str = str.toLowerCase();

    // remove accents, swap ñ for n, etc
    var from = "àáãäâèéëêìíïîòóöôùúüûñç·/_,:;";
    var to   = "aaaaaeeeeiiiioooouuuunc------";

    for (var i=0, l=from.length ; i<l ; i++) {
        str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
    }

    str = str.replace(/[^a-z0-9 -]/g, '') // remove invalid chars
        .replace(/\s+/g, '-') // collapse whitespace and replace by -
        .replace(/-+/g, '-'); // collapse dashes

    return str;
}

const {_, ...args} = arg({
    // 'raw'
    // 'minified
    // 'concat' 
    '--mode': String,
    '--download': Boolean
});



const options = {};

const toTwosComplementHex = (decimal: number) => {
    let size = 8;

    if (decimal >= 0) {
        let hexadecimal = decimal.toString(16);

        while ((hexadecimal.length % size) != 0) {
            hexadecimal = "" + 0 + hexadecimal;
        }

        return hexadecimal;
    } else {
        let hexadecimal = Math.abs(decimal).toString(16);
        while ((hexadecimal.length % size) != 0) {
            hexadecimal = "" + 0 + hexadecimal;
        }

        let output = '';
        for (let i = 0; i < hexadecimal.length; i++) {
            output += (0x0F - parseInt(hexadecimal[i], 16)).toString(16);
        }

        output = (0x01 + parseInt(output, 16)).toString(16);
        return output;
    }
};

const getPromise = async promise => {
    return Promise
        .resolve()
        .then(() => promise);
};

const calljobs = async promises => {
    try {
        const promise = await getPromise(promises.shift());

        if (!promises.length) {
            return promise;
        }

        return calljobs(promises);
    } catch (err) {
        console.error(err.message);
    }
};

if (_.includes('concat:clothes')) glob('results/scraper/{singleplayer,multiplayer}/a0f21ff8-clothing/*.json', options, (error: Error | null, files: Array<PathLike>) => {
    const jobs = [];
    
    const clothes = {
        multiplayer: [],
        singleplayer: []
    };
    
    for (const key in files) {
        const file = files[key];

        jobs[`${key}`] = {
            key: key,
            file: file,
            func: async (file: PathLike) => {
                const [_0, _1, mode, _2, pageIndex] = (file as string).replace('.json', '').split('/');
                const [error, data]: [any, string] = await to(fs.promises.readFile(file, 'utf8'));
        
                if (error) {
                    console.error('Failed to read file: ', error);
                    return;
                }
        
                const object: any = JSON.parse(data);
                if (pageIndex == '0') clothes[mode] = object;
                else clothes[mode].items = [...clothes[mode].items, ...object.items];
            }
        }
    }

    const f = ({file, func}) => new Promise(resolve =>  resolve(func(file))); //setTimeout(() => resolve(console.log(x)), 2000)

    (async () => {
        for (let job of jobs.map(x => () => f(x))) {
            await job();
        }

        const mode = args['--mode'];
        const result = (mode) 
                        ? clothes[mode.toLowerCase()]
                        : clothes;
        console.log(JSON.stringify(result, null, 4));
    })();
});

if (_.includes('minified') || _.includes('raw')) glob('results/scraper/{singleplayer,multiplayer}/*.json', options, (error: Error | null, files: Array<PathLike>) => {
    const data = files.map(async (file: PathLike) => {
        const [_0, _1, mode, category] = (file as string).replace('.json', '').split('/');
        const [error, data]: [any, string] = await to(fs.promises.readFile(file, 'utf8'));

        if (error) {
            console.error('Failed to read file: ', error);
            return;
        }

        const object: any = JSON.parse(data);

        const stripped: any = {
            mode: mode,
            category: category,
            items: object.items.map((item: any) => ({
                id: item.id,
                name: item.englishName || item.name,
                brand: item.brand,
                clothingVariations: item.clothingVariations.map((variant: any) => ({ twHex: toTwosComplementHex(variant.enumHash), enumHash: variant.enumHash })),
            }))
        };

        const full: any = {
            ...stripped,
            count: {
                store: object.total,
                items: (object.items) ? object.items.length : -1
            },
            items: object.items.map((item: any) => ({
                id: item.id,
                name: item.englishName || item.name,
                brand: item.brand,
                categories: item.categories,
                description: item.description || item.webDescription1,
                variations: item.variations,
                clothingVariations: item.clothingVariations.map((variant: any) => ({ twHex: toTwosComplementHex(variant.enumHash), ...variant })),
                group: item.group,
                images: item.images,
                slots: item.slots
            }))
        };

        const result = (_.includes('minified')) ? stripped : full;
        const queue = async.queue(download, 1);

        if (args['--download']) {
            full.items.forEach(item => {
                const { clothingVariations, brand, name, categories } = item;
                const isClothing = clothingVariations.length >= 1;
                const folder = (categories) ? categories[0] : 'nan';
                

                if (isClothing) {
                    writeObjectToFile(item, `./results/parser/clothes/${folder}/${slufigy(name)}/meta.json`);

                    clothingVariations.forEach(variation => {
                        const { thumbnailUrl, twHex } = variation;
                        queue.push({url: `http://prod.cloud.rockstargames.com${thumbnailUrl}`, destination: `./results/parser/clothes/${folder}/${slufigy(name)}/0x${twHex}.png`}, () => console.log('download called'));
                    });
                }
            });
            

        }

        return result;
    });

    (async () => {
        const promiseArray = await Promise.all(data);
        console.log(JSON.stringify(promiseArray, null, 4));
    })();
});