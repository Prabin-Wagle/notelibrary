<?php

declare(strict_types=1);

namespace App\Admin;

use App\Domain\Exceptions\ApiException;
use App\Infrastructure\Database\Database;
use PDO;

/** Admin CRUD adapters keep legacy screen concepts mapped to the normalized shared catalog. */
final class AdminPortalRepository
{
    public function __construct(private readonly Database $database)
    {
    }

    /** @param array<string, mixed> $query @return array<string, mixed> */
    public function dispatch(string $entity, string $method, array $query, array $body, int $adminId): array
    {
        return match ($entity) {
            'catalog-legacy-subjects' => $this->legacyCatalog($query),
            'books' => $this->books($method, $query, $body, $adminId),
            'notices', 'compat-getBlogs', 'compat-createBlog', 'compat-updateBlog', 'compat-deleteBlog' => $this->articles($entity, $method, $query, $body, $adminId),
            'notice-assets' => $this->noticeAssets($method, $query, $body),
            'video-playlists' => $this->playlists($method, $query, $body),
            'videos' => $this->videos($method, $query, $body),
            'quiz-collections' => $this->quizCollections($method, $query, $body),
            'quiz-authoring' => $this->quizAuthoring($method, $query, $body),
            'question-bank' => $this->questionBank($method, $query, $body),
            'question-assets' => ['success' => false, 'message' => 'Remote image import is disabled. Upload an image file from your device.'],
            'settings' => $this->settings($method, $body, $adminId),
            default => throw new ApiException('ADMIN_MODULE_NOT_FOUND', 'This admin module is not available.', 404),
        };
    }

    /** @param array<string, mixed> $query @return array<string, mixed> */
    private function legacyCatalog(array $query): array
    {
        $pdo = $this->database->connection();
        $action = (string) ($query['action'] ?? 'init');
        $classes = $pdo->query("SELECT DISTINCT name FROM academic_levels WHERE level_type IN ('grade','level') AND is_active = 1 ORDER BY sort_order")->fetchAll(PDO::FETCH_COLUMN);
        $faculties = $pdo->query("SELECT DISTINCT name FROM academic_levels WHERE level_type IN ('stream','faculty') AND is_active = 1 ORDER BY sort_order")->fetchAll(PDO::FETCH_COLUMN);
        $exams = $pdo->query("SELECT id, name AS exam_name FROM academic_programs WHERE program_type = 'entrance' AND is_active = 1 ORDER BY sort_order")->fetchAll();
        if ($action === 'exams') return ['success' => true, 'exams' => $exams];
        if ($action === 'subjects') {
            $rows = $pdo->query('SELECT name AS subject_name FROM subjects WHERE is_active = 1 ORDER BY name')->fetchAll();
            return ['success' => true, 'subjects' => $rows];
        }
        return ['success' => true, 'classes' => $classes, 'faculties' => $faculties, 'exams' => $exams];
    }

    /** @param array<string, mixed> $query @param array<string, mixed> $body @return array<string, mixed> */
    private function books(string $method, array $query, array $body, int $adminId): array
    {
        if ($method === 'GET') {
            $where = ["rt.code = 'book'", "r.status <> 'archived'"];
            $params = [];
            foreach (['class_level' => 'r.legacy_class_level', 'faculty' => 'r.legacy_faculty', 'subject' => 'r.legacy_subject'] as $key => $column) {
                if (!empty($query[$key])) { $where[] = "{$column} = :{$key}"; $params[$key] = $query[$key]; }
            }
            $statement = $this->database->connection()->prepare(
                'SELECT r.id, r.title, COALESCE(ra.external_url, ra.storage_path, \'\') AS drive_link,
                        r.summary AS description, r.legacy_class_level AS class_level, r.legacy_faculty AS faculty,
                        r.legacy_subject AS subject, r.created_at
                 FROM resources r INNER JOIN resource_types rt ON rt.id = r.resource_type_id
                 LEFT JOIN resource_assets ra ON ra.resource_id = r.id AND ra.asset_type = \'link\'
                 WHERE ' . implode(' AND ', $where) . ' ORDER BY r.updated_at DESC'
            );
            $statement->execute($params);
            return ['success' => true, 'data' => $statement->fetchAll()];
        }
        if ($method === 'DELETE') {
            $id = (int) ($query['id'] ?? 0);
            $this->database->connection()->prepare("UPDATE resources SET status = 'archived', updated_at = UTC_TIMESTAMP() WHERE id = :id")->execute(['id' => $id]);
            return ['success' => true, 'message' => 'Book archived.'];
        }
        $id = (int) ($body['id'] ?? 0);
        $title = $this->required($body, 'title');
        $pdo = $this->database->connection();
        $typeId = $this->typeId($pdo, 'book');
        $slug = $this->uniqueSlug($pdo, $title, $id);
        $asset = trim((string) ($body['drive_link'] ?? ''));
        if ($method === 'PUT' && $id > 0) {
            $pdo->prepare('UPDATE resources SET title=:title, slug=:slug, summary=:summary, legacy_class_level=:level, legacy_faculty=:faculty, legacy_subject=:subject, updated_at=UTC_TIMESTAMP() WHERE id=:id AND resource_type_id=:type')
                ->execute(['title'=>$title,'slug'=>$slug,'summary'=>$body['description']??null,'level'=>$body['class_level']??null,'faculty'=>$body['faculty']??null,'subject'=>$body['subject']??null,'id'=>$id,'type'=>$typeId]);
            $resourceId = $id;
        } else {
            $pdo->prepare("INSERT INTO resources (resource_type_id,author_user_id,title,slug,summary,status,visibility,created_at,updated_at) VALUES (:type,:admin,:title,:slug,:summary,'published',:visibility,UTC_TIMESTAMP(),UTC_TIMESTAMP())")
                ->execute(['type'=>$typeId,'admin'=>$adminId,'title'=>$title,'slug'=>$slug,'summary'=>$body['description']??null,'visibility'=>$this->defaultVisibility($pdo)]);
            $resourceId = (int) $pdo->lastInsertId();
            $pdo->prepare('UPDATE resources SET legacy_class_level=:level, legacy_faculty=:faculty, legacy_subject=:subject WHERE id=:id')
                ->execute(['level'=>$body['class_level']??null,'faculty'=>$body['faculty']??null,'subject'=>$body['subject']??null,'id'=>$resourceId]);
        }
        $pdo->prepare("DELETE FROM resource_assets WHERE resource_id=:id AND asset_type='link'")->execute(['id'=>$resourceId]);
        if ($asset !== '') $pdo->prepare("INSERT INTO resource_assets (resource_id,asset_type,external_url,created_at,updated_at) VALUES (:id,'link',:url,UTC_TIMESTAMP(),UTC_TIMESTAMP())")->execute(['id'=>$resourceId,'url'=>$asset]);
        return ['success'=>true,'message'=>'Book saved.','id'=>$resourceId];
    }

    /** @param array<string, mixed> $query @param array<string, mixed> $body @return array<string, mixed> */
    private function articles(string $entity, string $method, array $query, array $body, int $adminId): array
    {
        $pdo = $this->database->connection();
        if ($method === 'GET') {
            $type = ($query['type'] ?? '') === 'notice' ? 'notice' : 'blog';
            $stmt = $pdo->prepare('SELECT r.id,r.title,r.slug,r.summary AS excerpt,r.summary AS description,r.body AS content,r.status,r.legacy_class_level AS class,r.legacy_faculty AS faculty,r.legacy_exam_type AS exam_type,r.legacy_thumbnail_url AS thumbnail,r.created_at,r.updated_at FROM resources r INNER JOIN resource_types t ON t.id=r.resource_type_id WHERE t.code=:type AND r.status<>\'archived\' ORDER BY r.updated_at DESC');
            $stmt->execute(['type'=>$type]);
            $items=$stmt->fetchAll();
            return ['success'=>true,'data'=>$items,'blogs'=>$items];
        }
        if ($method === 'DELETE' || $entity === 'compat-deleteBlog') {
            $id = (int)($query['id'] ?? $body['id'] ?? 0);
            $pdo->prepare("UPDATE resources SET status='archived',updated_at=UTC_TIMESTAMP() WHERE id=:id")->execute(['id'=>$id]);
            return ['success'=>true,'message'=>'Content archived.'];
        }
        $title = $this->required($body, 'title');
        $content = (string)($body['content'] ?? $body['body'] ?? '');
        $type = (string)($body['type'] ?? $query['type'] ?? 'blog');
        if (!in_array($type, ['blog','notice'], true)) $type='blog';
        $id = (int)($body['id'] ?? 0);
        $typeId = $this->typeId($pdo, $type);
        $slug = $this->uniqueSlug($pdo, $title, $id);
        if ($method==='PUT' || $id>0) {
            $pdo->prepare('UPDATE resources SET resource_type_id=:type,title=:title,slug=:slug,summary=:summary,body=:body,status=:status,legacy_class_level=:class,legacy_faculty=:faculty,legacy_exam_type=:exam,legacy_thumbnail_url=:thumbnail,updated_at=UTC_TIMESTAMP() WHERE id=:id')
                ->execute(['type'=>$typeId,'title'=>$title,'slug'=>$slug,'summary'=>$body['excerpt']??$body['description']??null,'body'=>$content,'status'=>($body['status']??'published'),'class'=>$body['class']??null,'faculty'=>$body['faculty']??null,'exam'=>$body['exam_type']??null,'thumbnail'=>$body['thumbnail']??null,'id'=>$id]);
            return ['success'=>true,'message'=>'Content updated.','id'=>$id];
        }
        $pdo->prepare('INSERT INTO resources (resource_type_id,author_user_id,title,slug,summary,body,status,visibility,published_at,legacy_class_level,legacy_faculty,legacy_exam_type,legacy_thumbnail_url,created_at,updated_at) VALUES (:type,:admin,:title,:slug,:summary,:body,:status,:visibility,IF(:status2=\'published\',UTC_TIMESTAMP(),NULL),:class,:faculty,:exam,:thumbnail,UTC_TIMESTAMP(),UTC_TIMESTAMP())')
            ->execute(['type'=>$typeId,'admin'=>$adminId,'title'=>$title,'slug'=>isset($body['slug'])&&is_string($body['slug'])?$body['slug']:$slug,'summary'=>$body['excerpt']??$body['description']??null,'body'=>$content,'status'=>$body['status']??'published','status2'=>$body['status']??'published','visibility'=>$this->defaultVisibility($pdo),'class'=>$body['class']??null,'faculty'=>$body['faculty']??null,'exam'=>$body['exam_type']??null,'thumbnail'=>$body['thumbnail']??null]);
        return ['success'=>true,'message'=>'Content created.','id'=>(int)$pdo->lastInsertId()];
    }

    /** @param array<string, mixed> $query @param array<string, mixed> $body @return array<string, mixed> */
    private function noticeAssets(string $method, array $query, array $body): array
    {
        if ($method==='GET') {
            $rows=$this->database->connection()->query('SELECT id,file_name AS name,original_name,mime_type,file_size AS size,created_at FROM admin_media_assets ORDER BY created_at DESC')->fetchAll();
            foreach($rows as &$row){$row['url']='/api/v1/media/'.$row['name'];$row['type']=strtolower((string)pathinfo((string)$row['name'],PATHINFO_EXTENSION));$row['date']=strtotime((string)$row['created_at']);}unset($row);
            return ['success'=>true,'files'=>$rows,'data'=>$rows];
        }
        return ['success'=>true,'message'=>'Notice asset metadata saved.'];
    }

    /** @param array<string, mixed> $query @param array<string, mixed> $body @return array<string, mixed> */
    private function playlists(string $method, array $query, array $body): array
    {
        $pdo=$this->database->connection();
        if ($method==='GET') {
            $rows=$pdo->query("SELECT p.id,p.title,p.description,p.thumbnail_url AS thumbnail,p.is_active,p.created_at,
                COALESCE(GROUP_CONCAT(DISTINCT s.name ORDER BY s.name SEPARATOR ','),'') AS subjects,
                MAX(al.name) AS class_level,MAX(parent.name) AS faculty
                FROM video_playlists p LEFT JOIN video_playlist_subjects vps ON vps.playlist_id=p.id
                LEFT JOIN academic_subjects a ON a.id=vps.academic_subject_id LEFT JOIN subjects s ON s.id=a.subject_id
                LEFT JOIN academic_subjects pa ON pa.id=p.academic_subject_id LEFT JOIN academic_levels al ON al.id=pa.academic_level_id LEFT JOIN academic_levels parent ON parent.id=al.parent_id
                WHERE p.is_active=1 GROUP BY p.id ORDER BY p.sort_order,p.title")->fetchAll();
            foreach($rows as &$row){$row['subjects']=$row['subjects']===''?[]:explode(',',$row['subjects']);} unset($row);
            return ['success'=>true,'data'=>$rows];
        }
        if ($method==='DELETE') {$pdo->prepare('UPDATE video_playlists SET is_active=0,updated_at=UTC_TIMESTAMP() WHERE id=:id')->execute(['id'=>(int)($query['id']??0)]);return ['success'=>true];}
        $id=(int)($body['id']??0);$title=$this->required($body,'title');$subjects=$body['subjects']??[];
        if(!is_array($subjects))$subjects=[];
        $first=$this->academicSubjectId($pdo,(string)($subjects[0]??''));
        if($method==='PUT'&&$id>0){$pdo->prepare('UPDATE video_playlists SET title=:title,description=:description,thumbnail_url=:thumbnail,academic_subject_id=:subject,updated_at=UTC_TIMESTAMP() WHERE id=:id')->execute(['title'=>$title,'description'=>$body['description']??null,'thumbnail'=>$body['thumbnail']??null,'subject'=>$first,'id'=>$id]);$playlistId=$id;}
        else{$pdo->prepare('INSERT INTO video_playlists (academic_subject_id,title,description,thumbnail_url,is_active,created_at,updated_at) VALUES (:subject,:title,:description,:thumbnail,1,UTC_TIMESTAMP(),UTC_TIMESTAMP())')->execute(['subject'=>$first,'title'=>$title,'description'=>$body['description']??null,'thumbnail'=>$body['thumbnail']??null]);$playlistId=(int)$pdo->lastInsertId();}
        $pdo->prepare('DELETE FROM video_playlist_subjects WHERE playlist_id=:id')->execute(['id'=>$playlistId]);
        $insert=$pdo->prepare('INSERT IGNORE INTO video_playlist_subjects (playlist_id,academic_subject_id) VALUES (:playlist,:subject)');
        foreach($subjects as $name){$sid=$this->academicSubjectId($pdo,(string)$name);if($sid)$insert->execute(['playlist'=>$playlistId,'subject'=>$sid]);}
        return ['success'=>true,'id'=>$playlistId,'message'=>'Playlist saved.'];
    }

    /** @param array<string, mixed> $query @param array<string, mixed> $body @return array<string, mixed> */
    private function videos(string $method,array $query,array $body):array
    {
        $pdo=$this->database->connection();
        if($method==='GET'){$sql="SELECT v.id,v.playlist_id,v.title,v.description,v.thumbnail_url AS thumbnail,v.video_url AS video_link,v.created_at,p.title AS playlist_title,COALESCE(s.name,'') AS subject FROM videos v INNER JOIN video_playlists p ON p.id=v.playlist_id LEFT JOIN video_playlist_subjects vps ON vps.playlist_id=p.id LEFT JOIN academic_subjects a ON a.id=vps.academic_subject_id LEFT JOIN subjects s ON s.id=a.subject_id WHERE v.is_active=1";$params=[];if(!empty($query['playlist_id'])){$sql.=' AND v.playlist_id=:playlist';$params['playlist']=(int)$query['playlist_id'];}$sql.=' ORDER BY p.title,v.sort_order,v.title';$stmt=$pdo->prepare($sql);$stmt->execute($params);return ['success'=>true,'data'=>$stmt->fetchAll()];}
        if($method==='DELETE'){$pdo->prepare('UPDATE videos SET is_active=0,updated_at=UTC_TIMESTAMP() WHERE id=:id')->execute(['id'=>(int)($query['id']??0)]);return ['success'=>true];}
        $id=(int)($body['id']??0);$values=['playlist'=>(int)($body['playlist_id']??0),'title'=>$this->required($body,'title'),'description'=>$body['description']??null,'thumbnail'=>$body['thumbnail']??null,'url'=>$body['video_link']??$body['video_url']??''];
        if($values['playlist']<1||!filter_var($values['url'],FILTER_VALIDATE_URL))throw new ApiException('VALIDATION_FAILED','Choose a playlist and enter a valid video URL.',422);
        if($method==='PUT'&&$id>0){$pdo->prepare('UPDATE videos SET playlist_id=:playlist,title=:title,description=:description,thumbnail_url=:thumbnail,video_url=:url,updated_at=UTC_TIMESTAMP() WHERE id=:id')->execute($values+['id'=>$id]);}
        else{$pdo->prepare('INSERT INTO videos (playlist_id,title,description,thumbnail_url,video_url,is_active,created_at,updated_at) VALUES (:playlist,:title,:description,:thumbnail,:url,1,UTC_TIMESTAMP(),UTC_TIMESTAMP())')->execute($values);$id=(int)$pdo->lastInsertId();}
        return ['success'=>true,'id'=>$id,'message'=>'Video saved.'];
    }

    /** @param array<string, mixed> $query @param array<string, mixed> $body @return array<string, mixed> */
    private function quizCollections(string $method,array $query,array $body):array
    {
        $pdo=$this->database->connection();
        if($method==='GET')return ['success'=>true,'data'=>$pdo->query('SELECT id,title,competitive_exam,description,price,discount_price,image_url,is_active,created_at FROM quiz_collections WHERE is_active=1 ORDER BY created_at DESC')->fetchAll()];
        if($method==='DELETE'){$pdo->prepare('UPDATE quiz_collections SET is_active=0,updated_at=UTC_TIMESTAMP() WHERE id=:id')->execute(['id'=>(int)($query['id']??0)]);return ['success'=>true];}
        $id=(int)($body['id']??0);$values=['title'=>$this->required($body,'title'),'exam'=>$body['competitive_exam']??null,'description'=>$body['description']??null,'price'=>(float)($body['price']??0),'discount'=>isset($body['discount_price'])&&$body['discount_price']!==''?(float)$body['discount_price']:null,'image'=>$body['image_url']??$body['image']??null];
        if(($method==='PUT'||$id>0)&&$id>0){$pdo->prepare('UPDATE quiz_collections SET title=:title,competitive_exam=:exam,description=:description,price=:price,discount_price=:discount,image_url=:image,updated_at=UTC_TIMESTAMP() WHERE id=:id')->execute($values+['id'=>$id]);}
        else{$pdo->prepare('INSERT INTO quiz_collections (title,competitive_exam,description,price,discount_price,image_url,is_active,created_at,updated_at) VALUES (:title,:exam,:description,:price,:discount,:image,1,UTC_TIMESTAMP(),UTC_TIMESTAMP())')->execute($values);$id=(int)$pdo->lastInsertId();}
        return ['success'=>true,'id'=>$id,'message'=>'Test collection saved.'];
    }

    /** @param array<string, mixed> $query @param array<string, mixed> $body @return array<string, mixed> */
    private function quizAuthoring(string $method,array $query,array $body):array
    {
        $pdo=$this->database->connection();$id=(int)($body['id']??$query['id']??0);
        if($method==='GET'){$where='q.status<>\'archived\'';$params=[];if(!empty($query['collection_id'])){$where.=' AND q.collection_id=:collection';$params['collection']=(int)$query['collection_id'];}if($id){$where.=' AND q.id=:id';$params['id']=$id;}$stmt=$pdo->prepare("SELECT q.id,q.series_uid,q.collection_id,q.title AS quiz_title,q.competitive_exam,q.duration_seconds AS time_limit,q.negative_marking,q.delivery_mode AS mode,q.starts_at AS start_time,q.ends_at AS end_time,q.status,q.created_at,c.title AS collection_title FROM quizzes q LEFT JOIN quiz_collections c ON c.id=q.collection_id WHERE {$where} ORDER BY q.created_at DESC");$stmt->execute($params);$items=$stmt->fetchAll();foreach($items as &$item){$item['quiz_json']=$this->questionsForQuiz($pdo,(int)$item['id']);}unset($item);return ['success'=>true,'data'=>$id?($items[0]??null):$items];}
        if($method==='DELETE'){$pdo->prepare("UPDATE quizzes SET status='archived',updated_at=UTC_TIMESTAMP() WHERE id=:id")->execute(['id'=>(int)($query['id']??0)]);return ['success'=>true];}
        $questions=$body['quiz_json']??$body['questions']??[];if(is_string($questions))$questions=json_decode($questions,true)??[];if(!is_array($questions))$questions=[];
        $values=['collection'=>(int)($body['collection_id']??0)?:null,'title'=>$this->required($body,'quiz_title'),'exam'=>$body['competitive_exam']??null,'duration'=>max(1,(int)($body['time_limit']??60))*60,'negative'=>(float)($body['negative_marking']??0),'mode'=>strtoupper((string)($body['mode']??'NORMAL')),'start'=>$body['start_time']??null,'end'=>$body['end_time']??null];
        if(!in_array($values['mode'],['LIVE','NORMAL'],true))$values['mode']='NORMAL';
        $slug=$this->uniqueSlug($pdo,$values['title'],$id);
        $pdo->beginTransaction();try{
        if(($method==='PUT'||$id>0)&&$id>0){$pdo->prepare('UPDATE quizzes SET collection_id=:collection,title=:title,slug=:slug,competitive_exam=:exam,duration_seconds=:duration,negative_marking=:negative,delivery_mode=:mode,starts_at=:start,ends_at=:end,updated_at=UTC_TIMESTAMP() WHERE id=:id')->execute($values+['slug'=>$slug,'id'=>$id]);$quizId=$id;$pdo->prepare('DELETE FROM quiz_questions WHERE quiz_id=:id')->execute(['id'=>$quizId]);}
            else{$seriesUid=(string)($body['series_uid']??('NL-'.strtoupper(bin2hex(random_bytes(5)))));$pdo->prepare("INSERT INTO quizzes (collection_id,series_uid,academic_subject_id,title,slug,competitive_exam,status,duration_seconds,negative_marking,delivery_mode,starts_at,ends_at,total_marks,created_at,updated_at) VALUES (:collection,:uid,NULL,:title,:slug,:exam,'draft',:duration,:negative,:mode,:start,:end,0,UTC_TIMESTAMP(),UTC_TIMESTAMP())")->execute($values+['uid'=>$seriesUid,'slug'=>$slug]);$quizId=(int)$pdo->lastInsertId();}
            $qInsert=$pdo->prepare('INSERT INTO quiz_questions (quiz_id,question_type,question_text,explanation,image_url,unit_id,chapter_id,marks,negative_marks,sort_order,created_at,updated_at) VALUES (:quiz,\'single_choice\',:text,:explanation,:image,:unit,:chapter,:marks,:negative,:sort,UTC_TIMESTAMP(),UTC_TIMESTAMP())');
            $oInsert=$pdo->prepare('INSERT INTO question_options (question_id,option_text,is_correct,sort_order) VALUES (:question,:text,:correct,:sort)');$total=0;
            foreach(array_values($questions) as $qi=>$question){if(!is_array($question))continue;$text=trim((string)($question['questionText']??$question['question_text']??''));if($text==='')continue;$marks=(float)($question['marks']??1);$total+=$marks;$rawUnit=$question['unitId']??$question['unit_id']??null;$unitId=is_numeric($rawUnit)?(int)$rawUnit:null;$qInsert->execute(['quiz'=>$quizId,'text'=>$text,'explanation'=>$question['explanation']??null,'image'=>$question['imageLink']??$question['image_url']??null,'unit'=>$unitId,'chapter'=>isset($question['chapterId'])?(string)$question['chapterId']:(isset($question['chapter_id'])?(string)$question['chapter_id']:null),'marks'=>$marks,'negative'=>$values['negative'],'sort'=>$qi]);$qid=(int)$pdo->lastInsertId();$options=$question['options']??[];if(is_array($options))foreach(array_values($options) as $oi=>$option){$oInsert->execute(['question'=>$qid,'text'=>(string)$option,'correct'=>$oi===(int)($question['correctOption']??-1)?1:0,'sort'=>$oi]);}}
            $pdo->prepare('UPDATE quizzes SET total_marks=:marks WHERE id=:id')->execute(['marks'=>$total,'id'=>$quizId]);$pdo->commit();return ['success'=>true,'id'=>$quizId,'message'=>'Test series saved.'];
        }catch(\Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
    }

    /** @param array<string, mixed> $query @param array<string, mixed> $body @return array<string, mixed> */
    private function questionBank(string $method, array $query, array $body): array
    {
        $pdo = $this->database->connection();
        $action = (string) ($query['action'] ?? 'list_questions');
        $unit = (int) ($query['unit'] ?? $body['unit_id'] ?? 0);

        if ($method === 'GET' && $action === 'list_units') {
            $rows = $pdo->query(
                'SELECT u.id, u.title AS name, u.title
                 FROM subject_units u
                 WHERE u.is_active = 1
                 ORDER BY u.sort_order, u.title'
            )->fetchAll();

            return ['success' => true, 'data' => $rows, 'units' => $rows];
        }

        if ($method === 'GET' && $action === 'list_subjects') {
            $exam = strtoupper(trim((string) ($query['exam_code'] ?? '')));
            $sql = 'SELECT DISTINCT source_subject AS id, source_subject AS name
                    FROM admin_question_bank
                    WHERE is_active = 1 AND source_subject IS NOT NULL';
            $params = [];
            if (in_array($exam, ['IOE', 'CEE'], true)) {
                $sql .= ' AND exam_code = :exam';
                $params['exam'] = $exam;
            }
            $sql .= ' ORDER BY source_subject';
            $statement = $pdo->prepare($sql);
            $statement->execute($params);
            $rows = $statement->fetchAll();

            return ['success' => true, 'data' => $rows, 'subjects' => $rows];
        }

        if ($method === 'POST' && $action === 'import_json') {
            return $this->importQuestionBankJson($pdo, $body);
        }

        if ($method === 'GET') {
            [$where, $params] = $this->questionBankFilters($query, $unit);
            $count = $pdo->prepare("SELECT COUNT(*) FROM admin_question_bank q WHERE {$where}");
            $count->execute($params);
            $total = (int) $count->fetchColumn();
            $page = max(1, (int) ($query['page'] ?? 1));
            $pageSize = max(1, min(100, (int) ($query['limit'] ?? 50)));
            $offset = ($page - 1) * $pageSize;

            $statement = $pdo->prepare(
                "SELECT q.id, q.question_uid, q.question_text, q.chapter,
                        q.image_url AS image_link, q.explanation, q.correct_option, q.marks,
                        q.subject_unit_id AS unit_id, q.exam_code, q.source_subject,
                        q.source_file, q.source_question_id AS source_id,
                        q.source_row_number AS source_index, q.source_chapter_id, q.source_tags
                 FROM admin_question_bank q
                 WHERE {$where}
                 ORDER BY q.id DESC
                 LIMIT :page_size OFFSET :page_offset"
            );
            foreach ($params as $name => $value) {
                $statement->bindValue(':' . $name, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
            }
            $statement->bindValue(':page_size', $pageSize, PDO::PARAM_INT);
            $statement->bindValue(':page_offset', $offset, PDO::PARAM_INT);
            $statement->execute();
            $rows = $this->attachQuestionBankOptions($pdo, $statement->fetchAll());

            return [
                'success' => true,
                'data' => $rows,
                'questions' => $rows,
                'pagination' => [
                    'page' => $page,
                    'page_size' => $pageSize,
                    'total' => $total,
                    'total_pages' => max(1, (int) ceil($total / $pageSize)),
                ],
            ];
        }

        if ($method === 'DELETE') {
            $statement = $pdo->prepare(
                'UPDATE admin_question_bank
                 SET is_active = 0, updated_at = UTC_TIMESTAMP()
                 WHERE id = :id'
            );
            $statement->execute(['id' => (int) ($query['id'] ?? 0)]);

            return ['success' => true];
        }

        if ($method === 'POST' && $action === 'generate_random_set') {
            $config = is_array($body['config'] ?? null) ? $body['config'] : [];
            $limit = max(1, min(100, (int) ($config['count'] ?? 20)));
            [$where, $params] = $this->questionBankFilters($query, $unit);
            $statement = $pdo->prepare(
                "SELECT q.id, q.question_uid, q.question_text, q.chapter,
                        q.image_url AS image_link, q.explanation, q.correct_option, q.marks,
                        q.subject_unit_id AS unit_id, q.exam_code, q.source_subject,
                        q.source_file, q.source_question_id AS source_id,
                        q.source_row_number AS source_index, q.source_chapter_id, q.source_tags
                 FROM admin_question_bank q
                 WHERE {$where}
                 ORDER BY RAND()
                 LIMIT :question_limit"
            );
            foreach ($params as $name => $value) {
                $statement->bindValue(':' . $name, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
            }
            $statement->bindValue(':question_limit', $limit, PDO::PARAM_INT);
            $statement->execute();

            return ['success' => true, 'data' => $this->attachQuestionBankOptions($pdo, $statement->fetchAll())];
        }

        $id = (int) ($body['id'] ?? 0);
        $questionUid = $this->required($body, 'question_uid');
        $text = $this->required($body, 'question_text');
        $options = is_array($body['options'] ?? null) ? array_values($body['options']) : [];
        $correctOption = (int) ($body['correct_option'] ?? 0);
        if (count($options) < 2 || $correctOption < 0 || $correctOption >= count($options)) {
            throw new ApiException('QUESTION_INVALID', 'Add at least two options and select a valid correct answer.', 422);
        }

        $values = [
            'uid' => $questionUid,
            'unit' => $unit ?: null,
            'chapter' => $body['chapter'] ?? null,
            'text' => $text,
            'image' => $body['image_link'] ?? null,
            'explanation' => $body['explanation'] ?? null,
            'correct' => $correctOption,
            'marks' => (float) ($body['marks'] ?? 1),
        ];

        $pdo->beginTransaction();
        try {
            if ($id > 0) {
                $pdo->prepare(
                    'UPDATE admin_question_bank
                     SET question_uid = :uid, subject_unit_id = :unit, chapter = :chapter,
                         question_text = :text, image_url = :image, explanation = :explanation,
                         correct_option = :correct, marks = :marks, updated_at = UTC_TIMESTAMP()
                     WHERE id = :id'
                )->execute($values + ['id' => $id]);
                $questionId = $id;
                $pdo->prepare('DELETE FROM admin_question_options WHERE question_id = :id')->execute(['id' => $id]);
            } else {
                $pdo->prepare(
                    'INSERT INTO admin_question_bank
                        (question_uid, subject_unit_id, chapter, question_text, image_url,
                         explanation, correct_option, marks, is_active, created_at, updated_at)
                     VALUES
                        (:uid, :unit, :chapter, :text, :image, :explanation, :correct, :marks,
                         1, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
                )->execute($values);
                $questionId = (int) $pdo->lastInsertId();
            }

            $insertOption = $pdo->prepare(
                'INSERT INTO admin_question_options (question_id, option_text, sort_order, created_at)
                 VALUES (:question, :text, :sort, UTC_TIMESTAMP())'
            );
            foreach ($options as $index => $option) {
                $insertOption->execute([
                    'question' => $questionId,
                    'text' => (string) $option,
                    'sort' => $index,
                ]);
            }

            $pdo->commit();

            return ['success' => true, 'id' => $questionId, 'message' => 'Question saved.'];
        } catch (\Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $exception;
        }
    }

    /** @param array<string, mixed> $query @return array{0: string, 1: array<string, int|string>} */
    private function questionBankFilters(array $query, int $unit): array
    {
        $conditions = ['q.is_active = 1'];
        $params = [];

        if ($unit > 0) {
            $conditions[] = 'q.subject_unit_id = :unit';
            $params['unit'] = $unit;
        }

        $exam = strtoupper(trim((string) ($query['exam_code'] ?? '')));
        if (in_array($exam, ['IOE', 'CEE'], true)) {
            $conditions[] = 'q.exam_code = :exam';
            $params['exam'] = $exam;
        }

        $subject = trim((string) ($query['source_subject'] ?? ''));
        if ($subject !== '') {
            $conditions[] = 'q.source_subject = :source_subject';
            $params['source_subject'] = $subject;
        }

        $search = trim((string) ($query['search'] ?? ''));
        if ($search !== '') {
            $conditions[] = '(q.question_text LIKE :search_text OR q.question_uid LIKE :search_uid OR q.chapter LIKE :search_chapter OR q.source_subject LIKE :search_subject)';
            $params['search_text'] = '%' . $search . '%';
            $params['search_uid'] = '%' . $search . '%';
            $params['search_chapter'] = '%' . $search . '%';
            $params['search_subject'] = '%' . $search . '%';
        }

        return [implode(' AND ', $conditions), $params];
    }

    /** @param list<array<string, mixed>> $rows @return list<array<string, mixed>> */
    private function attachQuestionBankOptions(PDO $pdo, array $rows): array
    {
        if ($rows === []) {
            return [];
        }

        $ids = array_map(static fn (array $row): int => (int) $row['id'], $rows);
        $placeholders = [];
        foreach ($ids as $index => $_id) {
            $placeholders[] = ':question_' . $index;
        }
        $statement = $pdo->prepare(
            'SELECT question_id, option_text
             FROM admin_question_options
             WHERE question_id IN (' . implode(', ', $placeholders) . ')
             ORDER BY question_id, sort_order'
        );
        foreach ($ids as $index => $id) {
            $statement->bindValue(':question_' . $index, $id, PDO::PARAM_INT);
        }
        $statement->execute();

        $options = [];
        foreach ($statement->fetchAll() as $option) {
            $options[(int) $option['question_id']][] = $option['option_text'];
        }

        foreach ($rows as &$row) {
            $row['options'] = $options[(int) $row['id']] ?? [];
            $row['tags'] = json_decode((string) ($row['source_tags'] ?? '[]'), true) ?: [];
            unset($row['source_tags']);
        }
        unset($row);

        return $rows;
    }

    /** @param array<string, mixed> $body @return array<string, mixed> */
    private function importQuestionBankJson(PDO $pdo, array $body): array
    {
        if ((int) ($body['schemaVersion'] ?? $body['schema_version'] ?? 0) !== 1) {
            throw new ApiException('QUESTION_JSON_VERSION_UNSUPPORTED', 'Use question-bank JSON schema version 1.', 422);
        }

        $exam = strtoupper(trim((string) ($body['examCode'] ?? $body['exam_code'] ?? '')));
        if (!in_array($exam, ['IOE', 'CEE'], true)) {
            throw new ApiException('QUESTION_EXAM_INVALID', 'Choose IOE or CEE for this import.', 422);
        }

        $questions = $body['questions'] ?? null;
        if (!is_array($questions) || $questions === [] || count($questions) > 1000) {
            throw new ApiException('QUESTION_BATCH_INVALID', 'Import between 1 and 1,000 questions per request.', 422);
        }

        $upsert = $pdo->prepare(
            'INSERT INTO admin_question_bank
                (question_uid, exam_code, source_subject, source_file, source_question_id,
                 source_row_number, source_chapter_id, source_tags, source_question_key, chapter, question_text,
                 image_url, explanation, correct_option, marks, is_active, created_at, updated_at)
             VALUES
                (:uid, :exam, :subject, :file, :source_id, :source_index, :chapter_id, :tags, :source_key,
                 :chapter, :text, :image, :explanation, :correct, :marks, 1,
                 UTC_TIMESTAMP(), UTC_TIMESTAMP())
             ON DUPLICATE KEY UPDATE
                id = LAST_INSERT_ID(id), exam_code = VALUES(exam_code),
                source_subject = VALUES(source_subject), source_file = VALUES(source_file),
                source_question_id = VALUES(source_question_id), source_row_number = VALUES(source_row_number),
                source_chapter_id = VALUES(source_chapter_id),
                source_tags = VALUES(source_tags), chapter = VALUES(chapter),
                question_text = VALUES(question_text), image_url = VALUES(image_url),
                explanation = VALUES(explanation), correct_option = VALUES(correct_option),
                marks = VALUES(marks), is_active = 1, updated_at = UTC_TIMESTAMP()'
        );
        $deleteOptions = $pdo->prepare('DELETE FROM admin_question_options WHERE question_id = :id');
        $insertOption = $pdo->prepare(
            'INSERT INTO admin_question_options (question_id, option_text, sort_order, created_at)
             VALUES (:question, :text, :sort, UTC_TIMESTAMP())'
        );

        $inserted = 0;
        $updated = 0;
        $skipped = 0;
        $pdo->beginTransaction();
        try {
            foreach (array_values($questions) as $index => $question) {
                if (!is_array($question)) {
                    $skipped++;
                    continue;
                }

                $sourceFile = str_replace('\\', '/', trim((string) ($question['sourceFile'] ?? '')));
                $sourceId = trim((string) ($question['sourceId'] ?? ''));
                $sourceIndex = filter_var($question['sourceIndex'] ?? null, FILTER_VALIDATE_INT);
                $subject = trim((string) ($question['sourceSubject'] ?? ''));
                $chapter = trim((string) ($question['chapter'] ?? ''));
                $text = trim((string) ($question['questionText'] ?? ''));
                $options = is_array($question['options'] ?? null)
                    ? array_map(static fn (mixed $option): string => trim((string) $option), array_values($question['options']))
                    : [];
                $rawCorrectOption = $question['correctOption'] ?? null;
                $correctOption = is_numeric($rawCorrectOption) ? (int) $rawCorrectOption : -1;
                $marks = is_numeric($question['marks'] ?? null) ? (float) $question['marks'] : NAN;
                $image = $question['imageLink'] ?? null;

                if (
                    $sourceFile === '' || strlen($sourceFile) > 500 || $sourceId === '' || strlen($sourceId) > 120 ||
                    $sourceIndex === false || $sourceIndex < 1 ||
                    $subject === '' || strlen($subject) > 140 || $chapter === '' || strlen($chapter) > 200 ||
                    $text === '' || count($options) < 2 || count($options) > 32 || in_array('', $options, true) ||
                    !is_numeric($rawCorrectOption) || $correctOption < 0 || $correctOption >= count($options) ||
                    !is_finite($marks) || $marks < 0 || ($image !== null && (!is_string($image) || strlen($image) > 2000))
                ) {
                    $skipped++;
                    continue;
                }

                $sourceKey = hash('sha256', $exam . "\0" . $sourceFile . "\0" . $sourceIndex);
                $questionUid = $exam . '-' . strtoupper(substr($sourceKey, 0, 40));
                $tags = is_array($question['tags'] ?? null)
                    ? array_values(array_filter(array_map(static fn (mixed $tag): string => trim((string) $tag), $question['tags'])))
                    : [];
                $explanation = is_string($question['explanation'] ?? null) ? $question['explanation'] : null;
                $sourceChapterId = is_string($question['sourceChapterId'] ?? null) ? substr($question['sourceChapterId'], 0, 200) : null;

                $upsert->execute([
                    'uid' => $questionUid,
                    'exam' => $exam,
                    'subject' => $subject,
                    'file' => $sourceFile,
                    'source_id' => $sourceId,
                    'source_index' => $sourceIndex,
                    'chapter_id' => $sourceChapterId,
                    'tags' => json_encode($tags, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
                    'source_key' => $sourceKey,
                    'chapter' => $chapter,
                    'text' => $text,
                    'image' => $image,
                    'explanation' => $explanation,
                    'correct' => $correctOption,
                    'marks' => $marks,
                ]);
                $questionId = (int) $pdo->lastInsertId();
                $isNew = $upsert->rowCount() === 1;
                if ($isNew) {
                    $inserted++;
                } else {
                    $updated++;
                }

                $deleteOptions->execute(['id' => $questionId]);
                foreach ($options as $optionIndex => $option) {
                    $insertOption->execute([
                        'question' => $questionId,
                        'text' => $option,
                        'sort' => $optionIndex,
                    ]);
                }
            }

            $pdo->commit();
        } catch (\Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $exception;
        }

        return [
            'success' => true,
            'inserted' => $inserted,
            'updated' => $updated,
            'skipped' => $skipped,
            'processed' => $inserted + $updated + $skipped,
        ];
    }

    /** @return list<array<string, mixed>> */
    private function questionsForQuiz(PDO $pdo,int $quizId):array
    {
        $stmt=$pdo->prepare('SELECT id,question_text,explanation,marks,image_url,unit_id,chapter_id FROM quiz_questions WHERE quiz_id=:id ORDER BY sort_order');$stmt->execute(['id'=>$quizId]);$rows=$stmt->fetchAll();foreach($rows as $i=>&$row){$opt=$pdo->prepare('SELECT option_text,is_correct FROM question_options WHERE question_id=:id ORDER BY sort_order');$opt->execute(['id'=>$row['id']]);$options=$opt->fetchAll();$correct=0;$row['options']=[];foreach($options as $oi=>$option){$row['options'][]=$option['option_text'];if((int)$option['is_correct']===1)$correct=$oi;}$row['correctOption']=$correct;$row['questionId']=(string)$row['id'];$row['questionNo']=$i+1;$row['questionText']=$row['question_text'];$row['imageLink']=$row['image_url'];$row['unitId']=$row['unit_id'];}unset($row);return $rows;
    }

    /** @param array<string, mixed> $body @return array<string, mixed> */
    private function settings(string $method,array $body,int $adminId):array
    {
        $pdo=$this->database->connection();
        $defaults=[
            'workspace'=>['name'=>'Note Library','support_email'=>'support@notelibraryapp.com','timezone'=>'Asia/Kathmandu'],
            'content'=>['default_visibility'=>'authenticated','allow_student_bookmarks'=>true,'maintenance_mode'=>false],
            'uploads'=>['max_file_size_mb'=>25,'allowed_types'=>['pdf','png','jpg','jpeg','webp','mp4','webm']],
        ];
        $rows=$pdo->query('SELECT setting_key,setting_value FROM admin_settings')->fetchAll();
        $current=$defaults;
        foreach($rows as $row){$decoded=json_decode((string)$row['setting_value'],true);if(is_array($decoded))$current[(string)$row['setting_key']]=$decoded;}
        if($method==='GET')return ['success'=>true,'settings'=>$current];
        $incoming=$body['settings']??$body;if(!is_array($incoming))throw new ApiException('VALIDATION_FAILED','Settings must be an object.',422);
        foreach(['workspace','content','uploads'] as $key){
            if(!isset($incoming[$key])||!is_array($incoming[$key]))continue;
            $next=array_replace($current[$key],$incoming[$key]);
            if($key==='workspace'){
                $next['name']=mb_substr(trim((string)($next['name']??'')),0,120);
                $email=(string)($next['support_email']??'');
                if($next['name']===''||!filter_var($email,FILTER_VALIDATE_EMAIL))throw new ApiException('VALIDATION_FAILED','Workspace name and a valid support email are required.',422);
            }
            if($key==='uploads'){$next['max_file_size_mb']=max(1,min(100,(int)($next['max_file_size_mb']??25)));$next['allowed_types']=array_values(array_intersect((array)($next['allowed_types']??[]),['pdf','png','jpg','jpeg','webp','gif','mp4','webm']));}
            $current[$key]=$next;
            $pdo->prepare('INSERT INTO admin_settings (setting_key,setting_value,updated_by,updated_at) VALUES (:key,:value,:admin,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),updated_by=VALUES(updated_by),updated_at=UTC_TIMESTAMP()')
                ->execute(['key'=>$key,'value'=>json_encode($next,JSON_THROW_ON_ERROR),'admin'=>$adminId]);
        }
        return ['success'=>true,'settings'=>$current,'message'=>'Workspace settings saved.'];
    }

    private function typeId(PDO $pdo,string $code):int
    {
        $stmt=$pdo->prepare('SELECT id FROM resource_types WHERE code=:code AND is_active=1');$stmt->execute(['code'=>$code]);$id=$stmt->fetchColumn();if($id===false)throw new ApiException('RESOURCE_TYPE_NOT_FOUND','Content type is unavailable.',422);return (int)$id;
    }

    private function uniqueSlug(PDO $pdo,string $title,int $id=0):string
    {
        $slug=trim((string)preg_replace('/[^a-z0-9]+/','-',mb_strtolower($title)),'-');if($slug==='')$slug='item';$candidate=$slug;$suffix=2;
        while(true){$stmt=$pdo->prepare('SELECT id FROM resources WHERE slug=:resource_slug UNION SELECT id FROM quizzes WHERE slug=:quiz_slug LIMIT 1');$stmt->execute(['resource_slug'=>$candidate,'quiz_slug'=>$candidate]);$found=$stmt->fetchColumn();if($found===false||(int)$found===$id)return $candidate;$candidate=$slug.'-'.$suffix++;}
    }

    private function academicSubjectId(PDO $pdo,string $name):?int
    {
        if(trim($name)==='')return null;$stmt=$pdo->prepare('SELECT a.id FROM academic_subjects a INNER JOIN subjects s ON s.id=a.subject_id WHERE s.name=:name AND a.is_active=1 ORDER BY a.id LIMIT 1');$stmt->execute(['name'=>trim($name)]);$id=$stmt->fetchColumn();return $id===false?null:(int)$id;
    }

    private function defaultVisibility(PDO $pdo): string
    {
        $stored = $pdo->query("SELECT setting_value FROM admin_settings WHERE setting_key='content'")->fetchColumn();
        $content = is_string($stored) ? json_decode($stored, true) : null;
        return is_array($content) && ($content['default_visibility'] ?? '') === 'public' ? 'public' : 'authenticated';
    }

    /** @param array<string, mixed> $body */
    private function required(array $body,string $field):string
    {
        $value=isset($body[$field])&&is_scalar($body[$field])?trim((string)$body[$field]):'';if($value==='')throw new ApiException('VALIDATION_FAILED',"The {$field} field is required.",422,[$field=>['This field is required.']]);return $value;
    }
}
