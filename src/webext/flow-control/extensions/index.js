// @flow

import { takeEvery, call, put, race } from 'redux-saga/effects'
import { delay } from 'redux-saga'

import { get_webstore_url, get_crx_url } from '../../cws_pattern'
import { omit } from 'cmn/lib/all'
import { injectStatusPromise } from './utils'

import type { StatusInjection } from './utils'

const A = ([actionType]: string[]) => 'EXTENSIONS_' + actionType; // Action type prefixer

export const sagas = [];

type Id = string;
type Kind = 'chrome' | 'edge' | 'firefox' | 'opera';
type Entry = {
    kind: Kind,
    version: string,
    date: number, // download date
    size: number,
    isDownloading: boolean,
    progress: number, // percent 0-100
    storeUrl: string
}

export type Shape = {
    [Id]: Entry
}

const INITIAL = {};

let NEXT_ID = -1;

//
const ADD = A`ADD`;
type AddAction = { type:typeof ADD, entry:Entry };
const add = (entry): AddAction => ({ type:ADD, entry });

//
const DELETE = A`DELETE`;
type DeleteAction = { type:typeof DELETE, idOrIds:Id|Id[] };
const del = (idOrIds): DeleteAction => ({ type:DELETE, idOrIds });

//
const UPDATE = A`UPDATE`;
// type UpdateAction = { type:typeof UPDATE, id:Id, data:$Shape<Entry> };
type UpdateAction = { type:typeof UPDATE, id:Id, data:Entry };
const update = (id, data): UpdateAction => ({ type:UPDATE, id, data });

//
// storeUrl is webstore url - one that matches return of cws_pattern.js :: get_webstore_url
const REQUEST_ADD = A`REQUEST_ADD`;
type RequestAddAction = { type:typeof REQUEST_ADD, storeUrl:string, ...StatusInjection };
const requestAdd = (storeUrl): RequestAddAction => injectStatusPromise({ type:REQUEST_ADD, storeUrl });

function* requestAddWorker(action: RequestAddAction) {
    const { storeUrl, resolve } = action;


    const storeUrlFixed = get_webstore_url(storeUrl);
    if (!storeUrlFixed) return resolve({ storeUrl:'Not a valid store URL.' });
    console.log('storeUrlFixed:', storeUrlFixed);

    {
        let res, timeout;
        try { ({ res, timeout } = yield race({ timeout:call(delay, 10), res:call(fetch, storeUrlFixed) })) }
        catch(ex) { return resolve({ _error:'Unhandled error while validating URL: ' + ex.message }) }
        console.log('here, res:', res, 'timeout:', timeout);
        if (timeout) return resolve({ _error:'Connection timed out, please try again later.' });
        if (res.status !== 200) return resolve({ storeUrl:`Invalid status of "${res.status}" at URL.` });
    }

    // yield put(add({ kind:'chrome', storeUrl:storeUrlFixed }));

    resolve();
}
function* requestAddWatcher() {
    yield takeEvery(REQUEST_ADD, requestAddWorker);
}
sagas.push(requestAddWatcher);

//
type Action =
  | AddAction
  | DeleteAction
  | UpdateAction;

export default function reducer(state: Shape = INITIAL, action:Action): Shape {
    switch(action.type) {
        case DELETE: {
            const { idOrIds } = action;
            const ids = !Array.isArray(idOrIds) ? [idOrIds] : idOrIds;
            return omit({ ...state }, ...ids);
        }
        case ADD: {
            const { entry, entry:{ id } } = action;
            return { ...state, [id]:entry };
        }
        case UPDATE: {
            const { id, data } = action;
            const dataOld = state[id];
            const idNew = 'id' in data ? data.id : id;
            return { ...state, [idNew]:{ ...dataOld, ...data } };
        }
        default: return state;
    }
}

export { requestAdd }
