insert into public.roles (name, permissions) values
('管理者', '{"all": true}'),
('主催', '{"operator": true}'),
('幹事', '{"operator": true}'),
('準役員', '{"operator": true}'),
('一般会員', '{"member": true}')
on conflict (name) do nothing;

insert into public.messenger_threads (name, url, sort_order) values
('連絡用スレッド', 'https://www.facebook.com/messages/t/8306300582745011', 1);

insert into public.gallery_images (title, image_url, alt, sort_order) values
('月例会のテーブル商談', '/images/gallery-1.svg', '月例会のテーブル商談', 1),
('札幌での交流', '/images/gallery-2.svg', '札幌での交流', 2),
('北海道の食を楽しむ懇親', '/images/gallery-3.svg', '北海道の食を楽しむ懇親', 3),
('ビジネス紹介タイム', '/images/gallery-4.svg', 'ビジネス紹介タイム', 4);

delete from public.members;

insert into public.members (member_no, name, kana, email, phone, facebook_url, website_url, industry, major_industry, profile_image_url, bio, position, is_table_leader, status, is_visible) values
('880','鈴木 優','','member1@example.com','011-000-1001','https://www.facebook.com/','https://example.com/','営業研修・営業支援','その他','/images/member-1.svg','一般社団法人日本営業実践スキル協会。営業研修・営業支援を通じて、北のみなみ支部でのつながりと紹介を大切にしています。','主催',true,'在籍',true),
('4769','渡辺 穣','','member2@example.com','011-000-1002','https://www.facebook.com/','https://example.com/','保険代理店・資産運用','保険・建築業','/images/member-2.svg','株式会社ライフプラザパートナーズ。保険代理店・資産運用を通じて、北のみなみ支部でのつながりと紹介を大切にしています。','幹事',true,'在籍',true),
('4797','浅里 綾夏','','member3@example.com','011-000-1003','https://www.facebook.com/','https://example.com/','美容商材ディーラー','サービス業（飲食・美容など）','/images/member-3.svg','株式会社グロウ。美容商材ディーラーを通じて、北のみなみ支部でのつながりと紹介を大切にしています。','幹事',true,'在籍',true),
('4727','伊藤 瞳','','member4@example.com','011-000-1004','https://www.facebook.com/','https://example.com/','コンサルティング','その他','/images/member-4.svg','未来を創る幸福コンサルタント。コンサルティングを通じて、北のみなみ支部でのつながりと紹介を大切にしています。','準役員',true,'在籍',true),
('6789','中川 裕紀','','member5@example.com','011-000-1005','https://www.facebook.com/','https://example.com/','事務代行・営業代行','その他','/images/member-5.svg','オフィス凛。事務代行・営業代行を通じて、北のみなみ支部でのつながりと紹介を大切にしています。','準役員',true,'在籍',true),
('6808','井野 俊彦','','member6@example.com','011-000-1006','https://www.facebook.com/','https://example.com/','家計相談・資産運用','保険・建築業','/images/member-6.svg','株式会社アセットコネクション。家計相談・資産運用を通じて、北のみなみ支部でのつながりと紹介を大切にしています。','準役員',true,'在籍',true),
('7846','亀嶋 有希','','member7@example.com','011-000-1007','https://www.facebook.com/','https://example.com/','健康美容','サービス業（飲食・美容など）','/images/member-1.svg','saqina。健康美容を通じて、北のみなみ支部でのつながりと紹介を大切にしています。','準役員',true,'在籍',true),
('4794','野口 貴之','','member8@example.com','011-000-1008','https://www.facebook.com/','https://example.com/','DX推進・OA機器','IT・販売業','/images/member-2.svg','ラディックス株式会社。DX推進・OA機器を通じて、北のみなみ支部でのつながりと紹介を大切にしています。','一般会員',false,'在籍',true),
('4881','向畑 太輔','','member9@example.com','011-000-1009','https://www.facebook.com/','https://example.com/','ファッションスタイリスト','サービス業（飲食・美容など）','/images/member-3.svg','thankfulwork。ファッションスタイリストを通じて、北のみなみ支部でのつながりと紹介を大切にしています。','一般会員',false,'在籍',true),
('5235','菅咲 伎桂','','member10@example.com','011-000-1010','https://www.facebook.com/','https://example.com/','僧侶・葬儀・供養','その他','/images/member-4.svg','開成結社。僧侶・葬儀・供養を通じて、北のみなみ支部でのつながりと紹介を大切にしています。','一般会員',false,'在籍',true),
('6313','渡辺 匠','','member11@example.com','011-000-1011','https://www.facebook.com/','https://example.com/','造園業','保険・建築業','/images/member-5.svg','渡辺造園。造園業を通じて、北のみなみ支部でのつながりと紹介を大切にしています。','一般会員',false,'在籍',true),
('6716','髙橋 惺司','','member12@example.com','011-000-1012','https://www.facebook.com/','https://example.com/','飲食業','サービス業（飲食・美容など）','/images/member-6.svg','Bar あを衣。飲食業を通じて、北のみなみ支部でのつながりと紹介を大切にしています。','一般会員',false,'在籍',true),
('7834','石神 亜矢子','','member13@example.com','011-000-1013','https://www.facebook.com/','https://example.com/','訪問理美容・美容商材販売','サービス業（飲食・美容など）','/images/member-1.svg','株式会社訪問理美容LINK。訪問理美容・美容商材販売を通じて、北のみなみ支部でのつながりと紹介を大切にしています。','一般会員',false,'在籍',true),
('7871','岡本 英弥','','member14@example.com','011-000-1014','https://www.facebook.com/','https://example.com/','靴磨き・革製品メンテナンス','サービス業（飲食・美容など）','/images/member-2.svg','ヒデ磨き。靴磨き・革製品メンテナンスを通じて、北のみなみ支部でのつながりと紹介を大切にしています。','一般会員',false,'在籍',true),
('7855','木林 朋之','','member15@example.com','011-000-1015','https://www.facebook.com/','https://example.com/','ガラス・サッシ販売施工','保険・建築業','/images/member-3.svg','有限会社ヤマキガラス。ガラス・サッシ販売施工を通じて、北のみなみ支部でのつながりと紹介を大切にしています。','一般会員',false,'在籍',true),
('7857','吉村 勇紀','','member16@example.com','011-000-1016','https://www.facebook.com/','https://example.com/','Web広告・動画制作・SNS運用','IT・販売業','/images/member-4.svg','クリエイティブラボ株式会社。Web広告・動画制作・SNS運用を通じて、北のみなみ支部でのつながりと紹介を大切にしています。','一般会員',false,'在籍',true),
('8678','三浦 昂大','','member17@example.com','011-000-1017','https://www.facebook.com/','https://example.com/','建設・美装・リフォーム','保険・建築業','/images/member-5.svg','株式会社Bord。建設・美装・リフォームを通じて、北のみなみ支部でのつながりと紹介を大切にしています。','一般会員',false,'在籍',true),
('8676','三浦 涼華','','member18@example.com','011-000-1018','https://www.facebook.com/','https://example.com/','フットケア','サービス業（飲食・美容など）','/images/member-6.svg','ドクターネイル爪革命 札幌本店。フットケアを通じて、北のみなみ支部でのつながりと紹介を大切にしています。','一般会員',false,'在籍',true),
('8791','浜田 翠','','member19@example.com','011-000-1019','https://www.facebook.com/','https://example.com/','婚活・交流イベント','サービス業（飲食・美容など）','/images/member-1.svg','CASALBER JURABKAUR。婚活・交流イベントを通じて、北のみなみ支部でのつながりと紹介を大切にしています。','一般会員',false,'在籍',true),
('8876','中川 麻衣','','member20@example.com','011-000-1020','https://www.facebook.com/','https://example.com/','ネイルサロン・婚活カウンセラー','サービス業（飲食・美容など）','/images/member-2.svg','株式会社ライズエム。ネイルサロン・婚活カウンセラーを通じて、北のみなみ支部でのつながりと紹介を大切にしています。','一般会員',false,'在籍',true),
('8877','髙谷 理佳','','member21@example.com','011-000-1021','https://www.facebook.com/','https://example.com/','フットケア・無料相談','サービス業（飲食・美容など）','/images/member-3.svg','ドクターネイル爪革命 札幌本店。フットケア・無料相談を通じて、北のみなみ支部でのつながりと紹介を大切にしています。','一般会員',false,'在籍',true),
('9187','野々村 亮','','member22@example.com','011-000-1022','https://www.facebook.com/','https://example.com/','建築・リフォーム業','保険・建築業','/images/member-4.svg','株式会社内装いちばん。建築・リフォーム業を通じて、北のみなみ支部でのつながりと紹介を大切にしています。','一般会員',false,'在籍',true),
('9136','橋本 啓太','','member23@example.com','011-000-1023','https://www.facebook.com/','https://example.com/','行政書士','その他','/images/member-5.svg','はしもと行政書士事務所。行政書士を通じて、北のみなみ支部でのつながりと紹介を大切にしています。','一般会員',false,'在籍',true),
('9602','平澤 裕','','member24@example.com','011-000-1024','https://www.facebook.com/','https://example.com/','パーソナルジム','サービス業（飲食・美容など）','/images/member-6.svg','Liralive。パーソナルジムを通じて、北のみなみ支部でのつながりと紹介を大切にしています。','一般会員',false,'在籍',true),
('9563','大西 浩之','','member25@example.com','011-000-1025','https://www.facebook.com/','https://example.com/','建設業・新築リフォーム','保険・建築業','/images/member-1.svg','株式会社 新和ホーム。建設業・新築リフォームを通じて、北のみなみ支部でのつながりと紹介を大切にしています。','一般会員',false,'在籍',true),
('9566','前阪 去枝','','member26@example.com','011-000-1026','https://www.facebook.com/','https://example.com/','カウンセリング','サービス業（飲食・美容など）','/images/member-2.svg','カラーメンタリング。カウンセリングを通じて、北のみなみ支部でのつながりと紹介を大切にしています。','一般会員',false,'在籍',true),
('9626','八木 悠磨','','member27@example.com','011-000-1027','https://www.facebook.com/','https://example.com/','教育プログラム・コーチング','その他','/images/member-3.svg','一般社団法人カジュアルコーチング。教育プログラム・コーチングを通じて、北のみなみ支部でのつながりと紹介を大切にしています。','一般会員',false,'在籍',true),
('9147','中本 怜男','','member28@example.com','011-000-1028','https://www.facebook.com/','https://example.com/','情報通信業・ソフトウェア開発','IT・販売業','/images/member-4.svg','レイズ株式会社。情報通信業・ソフトウェア開発を通じて、北のみなみ支部でのつながりと紹介を大切にしています。','一般会員',false,'在籍',true),
('9714','坂本 彩','','member29@example.com','011-000-1029','https://www.facebook.com/','https://example.com/','SNS集客サポート・Webデザイン','IT・販売業','/images/member-5.svg','坂本 彩。SNS集客サポート・Webデザインを通じて、北のみなみ支部でのつながりと紹介を大切にしています。','一般会員',false,'在籍',true),
('9715','萩原 新','','member30@example.com','011-000-1030','https://www.facebook.com/','https://example.com/','ITコンサルタント・YouTube','IT・販売業','/images/member-6.svg','合同会社Riberte。ITコンサルタント・YouTubeを通じて、北のみなみ支部でのつながりと紹介を大切にしています。','一般会員',false,'在籍',true),
('9710','島田 尚幸','','member31@example.com','011-000-1031','https://www.facebook.com/','https://example.com/','外構工事・遺品整理・特殊清掃','保険・建築業','/images/member-1.svg','株式会社フィールド。外構工事・遺品整理・特殊清掃を通じて、北のみなみ支部でのつながりと紹介を大切にしています。','一般会員',false,'在籍',true),
('9740','藤井 善貴','','member32@example.com','011-000-1032','https://www.facebook.com/','https://example.com/','不動産業全般','保険・建築業','/images/member-2.svg','株式会社エステート221。不動産業全般を通じて、北のみなみ支部でのつながりと紹介を大切にしています。','一般会員',false,'在籍',true);

insert into public.monthly_meetings (title, meeting_date, start_time, end_time, venue_name, venue_address, note, application_deadline, status) values
('2026年4月 北のみなみ月例会','2026-04-17','16:00','18:00','札幌ビジネス交流ラウンジ','北海道札幌市中央区北1条西1丁目','過去開催分','2026-04-14','終了'),
('2026年5月 北のみなみ月例会','2026-05-15','16:00','18:00','札幌ビジネス交流ラウンジ','北海道札幌市中央区北1条西1丁目','過去開催分','2026-05-12','終了'),
('2026年7月 北のみなみ月例会','2026-07-17','16:00','18:00','札幌ビジネス交流ラウンジ','北海道札幌市中央区北1条西1丁目','受付は15:45からです。','2026-07-14','確定');
