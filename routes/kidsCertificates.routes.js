router.get(
  "/my-certificates",
  verifyToken,
  async (req,res) => {

    const childId =
      Number(
        req.query.child_id
      );

    const result =
      await pool.query(
        `
        SELECT

          kc.certificate_id,

          kc.issued_at,

          c.title
            AS course_title

        FROM kids_certificates kc

        JOIN kids_courses c

        ON c.id = kc.course_id

        WHERE kc.child_id = $1

        ORDER BY kc.id DESC
        `,
        [childId]
      );

    res.json({

      success:true,

      certificates:
        result.rows

    });

  }
);