import fs, { PathLike } from 'fs';

import glob from 'glob';
import arg from 'arg';
import to from 'await-to-js';

const args = arg({
    '--stripped': Boolean,
    '--full': Boolean,

    '-s': '--stripped',
    '-f': '--full',
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

glob('{singleplayer,multiplayer}/*.json', options, (error: Error | null, files: Array<PathLike>) => {
    const data = files.map(async (file: PathLike) => {
        const [mode, category] = (file as string).replace('.json', '').split('/');
        const [error, data]: [any, string] = await to(fs.promises.readFile(file, 'utf8'));

        if (error) {
            console.error('Failed to read file: ', error);
            return;
        }

        const json: any = JSON.parse(data);

        const stripped: any = {
            mode: mode,
            category: category,
            items: json.items.map((item: any) => ({
                id: item.id,
                name: item.englishName || item.name,
                brand: item.brand,
                clothingVariations: item.clothingVariations.map((variant: any) => ({ twHex: toTwosComplementHex(variant.enumHash), enumHash: variant.enumHash })),
            }))
        };

        const full: any = {
            ...stripped,
            count: {
                store: json.total,
                items: (json.items) ? json.items.length : -1
            },
            items: json.items.map((item: any) => ({
                id: item.id,
                name: item.englishName || item.name,
                brand: item.brand,
                description: item.description || item.webDescription1,
                variations: item.variations,
                clothingVariations: item.clothingVariations.map((variant: any) => ({ twHex: toTwosComplementHex(variant.enumHash), ...variant })),
                group: item.group,
                images: item.images,
                slots: item.slots
            }))
        };

        return (args['--stripped']) ? stripped : full;
    });

    (async () => {
        const promiseArray = await Promise.all(data);
        console.log(JSON.stringify(promiseArray, null, 4));
    })();
});