'use strict';
importScripts('generator.js');
self.onmessage = async ({data}) => {
  try {
    const puzzle = await new SumdokuGenerator().generateAsync(data.difficulty, null,
      progress => self.postMessage({progress}));
    self.postMessage({puzzle});
  } catch (error) {
    self.postMessage({error: error.message});
  }
};
