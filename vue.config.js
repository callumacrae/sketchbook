module.exports = {
  devServer: {
    disableHostCheck: true
  },
  lintOnSave: false,
  chainWebpack(config) {
    config.module
      .rule('glsl')
      .test(/\.(glsl|vs|fs|vert|frag)$/)
      .use('raw')
      .loader('raw-loader')
      .end()
      .use('gslsify')
      .loader('glslify-loader');
  }
};
