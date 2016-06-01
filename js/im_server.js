/* global RL_YTX, IM, $, hex_md5 */
'use strict';
/**
 * Created by JKZ on 2015/6/9.
 */

(function() {
    window.IM = window.IM || {
        // _appid: '20150314000000110000000000000010', // 应用I
        // 8a216da854ff8dcc0155023d7c340633
        _appid: window.IM_config.appId,
        _onUnitAccount: 'KF10089', // 多渠道客服帐号，目前只支持1个
        _3rdServer: 'http://123.57.230.158:8886/authen/', // 3rdServer，主要用来虚拟用户服务器获取SIG

        /** 以下不要动，不需要改动 */
        _timeoutkey: null,
        _username: null,
        _user_account: null,
        _contact_type_c: 'C', // 代表联系人
        _contact_type_g: 'G', // 代表群组
        _contact_type_m: 'M', // 代表多渠道客服
        _onMsgReceiveListener: null,
        _onDeskMsgReceiveListener: null,
        _noticeReceiveListener: null,
        _onConnectStateChangeLisenter: null,
        _onCallMsgListener: null,
        _isMcm_active: false,
        _local_historyver: 0,
        _msgId: null, // 消息ID，查看图片时有用
        _pre_range: null, // pre的光标监控对象
        _pre_range_num: 0, // 计数，记录pre中当前光标位置，以childNodes为单位
        _fireMessage: 'fireMessage',
        _serverNo: 'XTOZ',
        _baiduMap: null,
        _loginType: 1, // 登录类型: 1账号登录，3voip账号密码登录

        logs: function(str, type) {
            var type = type || 'info';
            console[type](str);
        },

        isNull: function(value) {
            if (value === '' || value === undefined
              || value == null) {
                return true;
            }
        },
        /**
         * 获取当前时间戳 YYYYMMddHHmmss
         *
         * @returns {*}
         */
        _getTimeStamp: function() {
            var now = new Date();
            var timestamp = now.getFullYear() + ''
                    + ((now.getMonth() + 1) >= 10 ? '' + (now.getMonth() + 1) : '0'
                            + (now.getMonth() + 1))
                    + (now.getDate() >= 10 ? now.getDate() : '0'
                            + now.getDate())
                    + (now.getHours() >= 10 ? now.getHours() : '0'
                            + now.getHours())
                    + (now.getMinutes() >= 10 ? now.getMinutes() : '0'
                            + now.getMinutes())
                    + (now.getSeconds() >= 10 ? now.getSeconds() : '0'
                            + now.getSeconds());
            return timestamp;
        },
        /**
         * 初始化
         *
         * @private
         */
        init: function(callback) {
            if (!window.IM_config.user_account) {
                alert('登录信息错误');
                return;
            }
            // 初始化SDK
            var resp = RL_YTX.init(IM._appid);
            if (!resp) {
                alert('SDK初始化错误');
                return;
            }
            if (resp.code === 200) {// 初始化成功
                // 初始化一些页面需要绑定的事件

                if ($.inArray(174004, resp.unsupport) > -1 || $.inArray(174009, resp.unsupport) > -1) {
                    // 不支持getUserMedia方法或者url转换
                    console.log('拍照、录音、音视频呼叫都不支持');
                } else if ($.inArray(174007, resp.unsupport) > -1) {
                    console.log('不支持发送附件');
                } else if ($.inArray(174008, resp.unsupport) > -1) {
                    console.log('不支持音视频呼叫，音视频不可用');
                }

                if (window.IM_config.user_account) {
                    this._login(window.IM_config.user_account, '', function() {
                        callback && callback.call(this);
                    });
                }
            } else if (resp.code === 174001) {// 不支持HTML5
                var r = confirm(resp.msg);
                if (r === true || r === false) {
                    window.close();
                }
            } else if (resp.code === 170002) {// 缺少必须参数
                console.log('错误码：170002,错误码描述' + resp.msg);
            } else {
                console.log('未知状态码');
            }
        },

        /**
         * 正式处理登录逻辑，此方法可供断线监听回调登录使用 获取时间戳，获取SIG，调用SDK登录方法
         *
         * @param user_account
         * @param pwd 密码
         * @private
         */
        _login: function(user_account, pwd, callback) {
            if (this.isNull(user_account)) {
                alert('请填写手机号后再登录');
                return;
            }
            // 校验登陆格式
            if (user_account.length > 128) {
                alert('长度不能超过128');
                return;
            }
            var regx1 = /^[^g|G].*$/;// 不能以g开头
            if (regx1.exec(user_account) == null) {
                alert('不能以g或者G开头');
                return;
            }
            if (user_account.indexOf('@') > -1) {
                var regx2 = /^[a-z0-9]+([._\\-]*[a-z0-9])*@([a-z0-9]+[-a-z0-9]*[a-z0-9]+.){1,63}[a-z0-9]+$/;
                if (regx2.exec(user_account) == null) {
                    alert('用户名只能是数字或字母，如果使用邮箱，请检查邮箱格式');
                    return;
                }
            } else {
                var regx3 = /^[a-zA-Z0-9_-]+$/;
                if (regx3.exec(user_account) == null) {
                    alert('用户名只能是数字或字母');
                    return;
                }
            }

            var timestamp = this._getTimeStamp();
            var flag = false;// 是否从第三方服务器获取sig
            if (flag) {
                IM._privateLogin(user_account, timestamp, function(obj) {
                    console.log('obj.sig:' + obj.sig);
                    IM.EV_login(user_account, pwd, obj.sig, timestamp, callback);
                }, function(obj) {
                    alert('错误码：' + obj.code + '; 错误描述：' + obj.msg);
                });
            } else {
                // 仅用于本地测试，官方不推荐这种方式应用在生产环境
                // 没有服务器获取sig值时，可以使用如下代码获取sig
                var appToken = window.IM_config.appToken;// 使用是赋值为应用对应的appToken
                var sig = hex_md5(IM._appid + user_account + timestamp + appToken);
                IM.EV_login(user_account, pwd, sig, timestamp, callback);
            }
        },

        /**
         * SIG获取 去第三方（客服）服务器获取SIG信息 并将SIG返回，传给SDK中的登录方法做登录使用
         *
         * @param user_account
         * @param timestamp -- 时间戳要与SDK登录方法中使用的时间戳一致
         * @param callback
         * @param onError
         * @private
         */
        _privateLogin: function(user_account, timestamp, callback, onError) {
            console.log('_privateLogin');
            var data = {
                'appid': IM._appid,
                'username': user_account,
                'timestamp': timestamp
            };
            var url = IM._3rdServer + 'genSig';
            $.ajax({
                url: url,
                dataType: 'jsonp',
                data: data,
                jsonp: 'cb',
                success: function(result) {
                    console.log('_privateLogin result:');
                    console.dir(result);
                    var resp = {};
                    if (result.code !== '000000') {
                        resp.code = result.code;
                        resp.msg = 'Get SIG fail from 3rd server!...';
                        onError(resp);
                        return;
                    } else {
                        resp.code = result.code;
                        resp.sig = result.sig;
                        callback(resp);
                        return;
                    }
                },
                error: function() {
                    var resp = {};
                    resp.msg = 'Get SIG fail from 3rd server!';
                    onError(resp);
                },
                timeout: 5000
            });
        },

        /**
         * 事件，登录 去SDK中请求登录
         *
         * @param user_account
         * @param sig
         * @param timestamp --
         *            时间戳要与生成SIG参数的时间戳保持一致
         * @constructor
         */
        EV_login: function(user_account, pwd, sig, timestamp, callback) {
            console.log('EV_login');
            var that = this;
            var loginBuilder = new RL_YTX.LoginBuilder();
            loginBuilder.setType(IM._loginType);
            loginBuilder.setUserName(user_account);
            if (IM._loginType === 1) {// 1是自定义账号，3是voip账号
                loginBuilder.setSig(sig);
            }
            loginBuilder.setTimestamp(timestamp);

            RL_YTX.login(loginBuilder, function() {
                console.log('EV_login succ...: ');
                IM._user_account = user_account;
                IM._username = user_account;
                callback && callback.call(that);
            }, function(obj) {
                alert('登录错误码： ' + obj.code + '; 错误描述：' + obj.msg);
            });
        },

        /**
         * 检查联系名称规则是否合法
         *
         * @param contactVal
         * @returns {boolean}
         * @constructor
         */
        DO_checkContact: function(contactVal) {
            if (!contactVal) {
                IM.HTML_showAlert('alert-warning', '请填写联系人');
                return false;
            }
            if (contactVal.indexOf('#') > -1 && contactVal.length > 161) {
                IM.HTML_showAlert('alert-error', '跨应用联系人长度不能超过161');
                return false;
            } else if (contactVal.length > 128) {
                IM.HTML_showAlert('alert-error', '联系人长度不能超过128');
                return false;
            }
            if (contactVal.substr(0, 1) === 'g') {
                IM.HTML_showAlert('alert-error', '联系人不能以"g"开始');
                return false;
            }

            if (contactVal.indexOf('@') > -1) {
                var regx2 = /^([a-zA-Z0-9]{32}#)?[a-zA-Z0-9_-]{1,}@(([a-zA-z0-9]-*){1,}.){1,3}[a-zA-z-]{1,}$/;
                if (regx2.exec(contactVal) == null) {
                    IM.HTML_showAlert('alert-error',
                            '检查邮箱格式、如果是跨应用再检查应用Id长度是否为32且由数字或字母组成）');
                    return false;
                }
            } else {
                var regx1 = /^([a-zA-Z0-9]{32}#)?[A-Za-z0-9_-]+$/;
                if (regx1.exec(contactVal) == null) {
                    IM.HTML_showAlert('alert-error',
                                    '联系人只能使用数字、_、-、大小写英文组成; 如果是跨应用则应用id长度为32位由数字或大小写英文组成');
                    return false;
                }
            }
            return true;
        },

        _checkGroupName: function(groupName) {
            if (!groupName) {
                IM.HTML_showAlert('alert-error', '请填写群组名称，用来创建群组');
                return false;
            } else {// 校验群组名称的合法性
                var regx1 = /^[\\x00-\\x7F\a-zA-Z\u4e00-\u9fa5_-]{0,10}$/;
                if (regx1.exec(groupName) == null) {
                    alert('群组名只允许中英文数字@_-,长度不超过10');
                    return false;
                }
                if (/^g/i.test(groupName)) {
                    alert('群组名不能以g或G开头');
                    return false;
                }
                if (/@/g.test(groupName)) {
                    alert('群组名不能含有@符号');
                    return false;
                }
            }
            return true;
        },

        /**
         * 事件，创建群组
         *
         * @param groupName
         * @param permission 1随便加入 2要验证  3私有  4讨论组
         * @constructor
         */
        createGroup: function(groupName, permission, memberSts, declared, callback) {
            if (!this._checkGroupName(groupName)) {
                return;
            }
            var that = this;
            var obj = new RL_YTX.CreateGroupBuilder();
            obj.setGroupName(groupName);
            obj.setPermission(permission);
            // 群组说明
            obj.setDeclared(declared);

            // target参数 1讨论组 2 群组
            if (permission === 4) {
                obj.setTarget(1);
            } else {
                obj.setTarget(2);
            }

            RL_YTX.createGroup(obj, function(obj) {
                var groupId = obj.data;
                IM.logs('create group succ... [groupId:' + groupId + ']');
                that.inviteGroupMember(groupId, permission, true, groupName, memberSts);
                callback && callback.call(this, {
                    groupId: groupId,
                    groupName: groupName
                });
            }, function(obj) {
                alert('创建讨论组错误：错误码： ' + obj.code + '; 错误描述：' + obj.msg);
                return;
            });
        },
        /**
         * 邀请成员加入群组
         *
         * @param groupId
         * @param permission
         * @constructor
         */
        inviteGroupMember: function(groupId, permission, isowner, groupName, memberSts) {
            var maxInvite = 50;
            // 分批邀请
            var inviteMember = function(memberArr) {
                var confirm = 1; // 是否需要邀请者确认 可选 1不需要 2需要 默认为2
                var builder = new RL_YTX.InviteJoinGroupBuilder(groupId, null, memberArr, confirm);
                RL_YTX.inviteJoinGroup(builder, function() {}, function() {});
            };
            // 剔除不符合邀请用户
            var resetMember = function(memberArr) {
                var number = memberArr.length;
                for (var i = 0; i < number; i++) {
                    if (memberArr[i] === IM._user_account || !IM.DO_checkContact(memberArr[i])) {
                        memberArr.splice(i, 1);
                    }
                }
                return memberArr;
            };
            var memberArr = resetMember(memberSts.split(','));
            var inviteNum = memberArr.length;
            // 总批次
            var queeLen = Math.ceil(inviteNum / maxInvite);

            if (!queeLen) {
                return;
            }

            for (var i = 0; i < queeLen; i++) {
                var _memberArr = memberArr.slice(i * maxInvite, (i + 1) * maxInvite);
                inviteMember(_memberArr);
            }
        }
    };
})();

