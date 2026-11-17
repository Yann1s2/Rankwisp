import base from './playwright.config.js';
export default {...base,testMatch:'native-auth.spec.js',use:{...base.use,baseURL:'http://127.0.0.1:4320'}};
