ALTER TABLE student_profiles
    ADD COLUMN province VARCHAR(100) NULL AFTER phone,
    ADD COLUMN district VARCHAR(100) NULL AFTER province,
    ADD COLUMN city VARCHAR(120) NULL AFTER district,
    ADD COLUMN education_class VARCHAR(40) NULL AFTER city,
    ADD COLUMN faculty VARCHAR(100) NULL AFTER education_class,
    ADD COLUMN competition VARCHAR(150) NULL AFTER faculty;
