    constants.updateByKey failed: column constants.imo_id does not exist

the above happens in ths system settings when trying to enter/save Average Annual Premium Override
Here's the error stack:

fetch.js:8 PATCH https://pcyaqwodnyrpkaiojnpz.supabase.co/rest/v1/constants?imo_id=eq.89514211-f2bd-4440-9527-90a472c5e622&key=eq.avgAP 400 (Bad Request)
(anonymous) @ fetch.js:8
(anonymous) @ fetch.js:28
await in (anonymous)
then @ PostgrestBuilder.js:72Understand this error
installHook.js:1 2026-05-24T16:21:56.839Z [BaseRepository.constants] ERROR: constants.updateByKey failed: column constants.imo_id does not exist [object Object]
overrideMethod @ installHook.js:1
log @ logger.ts:85
error @ logger.ts:122
handleError @ BaseRepository.ts:254
updateByKey @ ConstantsRepository.ts:144
await in updateByKey
setValue @ constantsService.ts:106
(anonymous) @ useConstants.ts:69
(anonymous) @ mutation.js:74
(anonymous) @ retryer.js:77
(anonymous) @ retryer.js:119
execute @ mutation.js:113
await in execute
mutate @ mutationObserver.js:61
(anonymous) @ ConstantsManagement.tsx:53
(anonymous) @ ConstantsManagement.tsx:147
processDispatchQueue @ react-dom-client.production.js:12317
(anonymous) @ react-dom-client.production.js:12867
batchedUpdates$1 @ react-dom-client.production.js:1498
dispatchEventForPluginEventSystem @ react-dom-client.production.js:12455
dispatchEvent @ react-dom-client.production.js:15306
dispatchDiscreteEvent @ react-dom-client.production.js:15274Understand this error
installHook.js:1 2026-05-24T16:21:56.839Z [ConstantsService] ERROR: Error updating constant avgAP Error: constants.updateByKey failed: column constants.imo_id does not exist
at HPt.handleError (BaseRepository.ts:273:12)
at HPt.updateByKey (ConstantsRepository.ts:144:18)
at async Object.setValue (constantsService.ts:106:7)
at async Object.mutationFn (useConstants.ts:69:7)
overrideMethod @ installHook.js:1
log @ logger.ts:85
error @ logger.ts:122
setValue @ constantsService.ts:108
await in setValue
(anonymous) @ useConstants.ts:69
(anonymous) @ mutation.js:74
(anonymous) @ retryer.js:77
(anonymous) @ retryer.js:119
execute @ mutation.js:113
await in execute
mutate @ mutationObserver.js:61
(anonymous) @ ConstantsManagement.tsx:53
(anonymous) @ ConstantsManagement.tsx:147
processDispatchQueue @ react-dom-client.production.js:12317
(anonymous) @ react-dom-client.production.js:12867
batchedUpdates$1 @ react-dom-client.production.js:1498
dispatchEventForPluginEventSystem @ react-dom-client.production.js:12455
dispatchEvent @ react-dom-client.production.js:15306
dispatchDiscreteEvent @ react-dom-client.production.js:15274Understand this error
fetch.js:8 PATCH https://pcyaqwodnyrpkaiojnpz.supabase.co/rest/v1/constants?imo_id=eq.89514211-f2bd-4440-9527-90a472c5e622&key=eq.avgAP 400 (Bad Request)
(anonymous) @ fetch.js:8
(anonymous) @ fetch.js:28
await in (anonymous)
then @ PostgrestBuilder.js:72Understand this error
installHook.js:1 2026-05-24T16:21:58.107Z [BaseRepository.constants] ERROR: constants.updateByKey failed: column constants.imo_id does not exist [object Object]
overrideMethod @ installHook.js:1
log @ logger.ts:85
error @ logger.ts:122
handleError @ BaseRepository.ts:254
updateByKey @ ConstantsRepository.ts:144
await in updateByKey
setValue @ constantsService.ts:106
(anonymous) @ useConstants.ts:69
(anonymous) @ mutation.js:74
(anonymous) @ retryer.js:77
(anonymous) @ retryer.js:101
Promise.then
(anonymous) @ retryer.js:97
Promise.catch
(anonymous) @ retryer.js:81
(anonymous) @ retryer.js:119
execute @ mutation.js:113
await in execute
mutate @ mutationObserver.js:61
(anonymous) @ ConstantsManagement.tsx:53
(anonymous) @ ConstantsManagement.tsx:147
processDispatchQueue @ react-dom-client.production.js:12317
(anonymous) @ react-dom-client.production.js:12867
batchedUpdates$1 @ react-dom-client.production.js:1498
dispatchEventForPluginEventSystem @ react-dom-client.production.js:12455
dispatchEvent @ react-dom-client.production.js:15306
dispatchDiscreteEvent @ react-dom-client.production.js:15274Understand this error
installHook.js:1 2026-05-24T16:21:58.107Z [ConstantsService] ERROR: Error updating constant avgAP Error: constants.updateByKey failed: column constants.imo_id does not exist
at HPt.handleError (BaseRepository.ts:273:12)
at HPt.updateByKey (ConstantsRepository.ts:144:18)
at async Object.setValue (constantsService.ts:106:7)
at async Object.mutationFn (useConstants.ts:69:7)
overrideMethod @ installHook.js:1
log @ logger.ts:85
error @ logger.ts:122
setValue @ constantsService.ts:108
await in setValue
(anonymous) @ useConstants.ts:69
(anonymous) @ mutation.js:74
(anonymous) @ retryer.js:77
(anonymous) @ retryer.js:101
Promise.then
(anonymous) @ retryer.js:97
Promise.catch
(anonymous) @ retryer.js:81
(anonymous) @ retryer.js:119
execute @ mutation.js:113
await in execute
mutate @ mutationObserver.js:61
(anonymous) @ ConstantsManagement.tsx:53
(anonymous) @ ConstantsManagement.tsx:147
processDispatchQueue @ react-dom-client.production.js:12317
(anonymous) @ react-dom-client.production.js:12867
batchedUpdates$1 @ react-dom-client.production.js:1498
dispatchEventForPluginEventSystem @ react-dom-client.production.js:12455
dispatchEvent @ react-dom-client.production.js:15306
dispatchDiscreteEvent @ react-dom-client.production.js:15274Understand this error
installHook.js:1 2026-05-24T16:21:58.108Z [Migration] ERROR: Error updating constant Error: constants.updateByKey failed: column constants.imo_id does not exist
at HPt.handleError (BaseRepository.ts:273:12)
at HPt.updateByKey (ConstantsRepository.ts:144:18)
at async Object.setValue (constantsService.ts:106:7)
at async Object.mutationFn (useConstants.ts:69:7)

######

######

######
